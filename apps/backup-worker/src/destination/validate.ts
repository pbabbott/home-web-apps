import { createHash, randomBytes } from 'crypto';
import fsPromises from 'fs/promises';
import path from 'path';
import type {
  BackupDestinationValidation,
  BackupDestinationWithHost,
} from '@abbottland/homelab-db';
import {
  assertNoSymlinks,
  resolveWithinRoot,
  UnsafePathError,
} from '../lib/safe-path';
import {
  checkNfsMount,
  expectedExport,
  parseProcMounts,
  type MountEntry,
} from './mounts';

export const PROBE_DIR_PREFIX = '.exodus-probe-';
export const STAGING_DIR_NAME = '.exodus-staging';
export const ROOT_ENTRIES_CAP = 1000;

/** The filesystem calls validation makes, so tests can inject faults. */
export type ValidationFs = Pick<
  typeof fsPromises,
  | 'lstat'
  | 'stat'
  | 'mkdir'
  | 'readdir'
  | 'readFile'
  | 'open'
  | 'link'
  | 'rename'
  | 'utimes'
  | 'rm'
  | 'statfs'
>;

export type ValidationDeps = {
  fs: ValidationFs;
  /** The parsed /proc/mounts. */
  readMounts: () => Promise<MountEntry[]>;
  now: () => Date;
  randomId: () => string;
  /** Wraps each destination call, so the watchdog sees it. */
  run: <T>(operation: string, fn: () => Promise<T>) => Promise<T>;
  getUid: () => number;
  getGid: () => number;
};

export type ValidationInput = {
  destination: Pick<BackupDestinationWithHost, 'host' | 'settings' | 'rootDir'>;
  mountPath: string;
  mountCheck: 'nfs' | 'none';
};

export const defaultValidationDeps = (
  run: ValidationDeps['run'] = (_operation, fn) => fn(),
): ValidationDeps => ({
  fs: fsPromises,
  readMounts: async () =>
    parseProcMounts(await fsPromises.readFile('/proc/mounts', 'utf8')),
  now: () => new Date(),
  randomId: () => randomBytes(6).toString('hex'),
  run,
  getUid: () => process.getuid?.() ?? -1,
  getGid: () => process.getgid?.() ?? -1,
});

type Check = NonNullable<BackupDestinationValidation['checks']>[number];

const errnoOf = (err: unknown): string =>
  (err as NodeJS.ErrnoException)?.code ?? 'ERROR';

const describe = (err: unknown): string =>
  err instanceof Error
    ? `${errnoOf(err)}: ${err.message}`
    : `ERROR: ${String(err)}`;

const isHiddenFromRootEntries = (name: string): boolean =>
  name.startsWith(PROBE_DIR_PREFIX) || name === STAGING_DIR_NAME;

/** Thrown by a probe step; the message names the step. */
class ProbeStepError extends Error {}

const sha256 = (data: Buffer): string =>
  createHash('sha256').update(data).digest('hex');

/**
 * Checks that the worker's destination is the right one and is usable
 * (plan.md §6). Pure with respect to its inputs: every effect goes through
 * `deps`. Writes only inside a transient `.exodus-probe-<random>/` folder
 * (removed afterwards) and, when missing, creates `rootDir`.
 */
export const validateDestination = async (
  input: ValidationInput,
  deps: ValidationDeps,
): Promise<BackupDestinationValidation> => {
  const { destination, mountPath, mountCheck } = input;
  const { fs, run } = deps;
  const checks: Check[] = [];
  const findings: Record<string, unknown> = {
    mountPath,
    checkedAt: deps.now().toISOString(),
  };
  const mountVerified = mountCheck === 'nfs';

  const fail = (name: string, message: string): BackupDestinationValidation => {
    checks.push({ name, ok: false, message });
    return { ok: false, mountVerified, checks, findings };
  };

  // 1. Mount identity.
  if (mountCheck === 'none') {
    checks.push({
      name: 'mount',
      ok: true,
      message: 'mount check disabled (BACKUP_DESTINATION_MOUNT_CHECK=none)',
    });
  } else {
    let mounts: MountEntry[];
    try {
      mounts = await run('read mounts', deps.readMounts);
    } catch (err) {
      return fail('mount', `could not read /proc/mounts: ${describe(err)}`);
    }

    const result = checkNfsMount(
      mounts,
      mountPath,
      expectedExport(destination),
    );

    if ('message' in result) {
      if (result.entry) {
        findings.mount = {
          device: result.entry.device,
          fsType: result.entry.fsType,
        };
      }
      return fail('mount', result.message);
    }

    findings.mount = {
      device: result.entry.device,
      fsType: result.entry.fsType,
      options: result.entry.options,
    };
    checks.push({ name: 'mount', ok: true });
  }

  // 2. The folder Exodus writes in.
  const rootPath = resolveWithinRoot(mountPath, destination.rootDir ?? '');

  if (rootPath === null) {
    return fail('root', `root_dir "${destination.rootDir}" escapes the mount`);
  }

  try {
    const mountStat = await run('stat mount', () => fs.stat(mountPath));
    if (!mountStat.isDirectory()) {
      return fail('root', `${mountPath} is not a directory`);
    }
  } catch (err) {
    return fail('root', `${mountPath} is not accessible: ${describe(err)}`);
  }

  try {
    await run('check root for symlinks', () =>
      assertNoSymlinks(mountPath, rootPath, (p) => fs.lstat(p)),
    );
    await run('create root', () => fs.mkdir(rootPath, { recursive: true }));
    const rootStat = await run('stat root', () => fs.stat(rootPath));
    if (!rootStat.isDirectory()) {
      return fail('root', `${rootPath} is not a directory`);
    }
  } catch (err) {
    return fail(
      'root',
      err instanceof UnsafePathError ? err.message : describe(err),
    );
  }
  checks.push({ name: 'root', ok: true });

  // Read-only listing, before the probe writes anything.
  let rootEntries: string[];
  try {
    const names = await run('list root', () => fs.readdir(rootPath));
    const visible = names.filter((n) => !isHiddenFromRootEntries(n)).sort();
    rootEntries = visible.slice(0, ROOT_ENTRIES_CAP);
    if (visible.length > ROOT_ENTRIES_CAP) {
      findings.rootEntriesTruncated = visible.length;
    }
  } catch (err) {
    return fail('root', `could not list ${rootPath}: ${describe(err)}`);
  }

  // 3. Write probe.
  const probeDir = path.join(rootPath, `${PROBE_DIR_PREFIX}${deps.randomId()}`);
  const probeFindings: Record<string, unknown> = {};

  try {
    await runProbe(probeDir, probeFindings, deps);
    checks.push({ name: 'probe', ok: true });
  } catch (err) {
    checks.push({
      name: 'probe',
      ok: false,
      message: err instanceof ProbeStepError ? err.message : describe(err),
    });
  } finally {
    try {
      await run('remove probe', () =>
        fs.rm(probeDir, { recursive: true, force: true }),
      );
    } catch (err) {
      checks.push({
        name: 'probe_cleanup',
        ok: false,
        message: `could not remove ${probeDir}: ${describe(err)}`,
      });
    }
  }
  Object.assign(findings, probeFindings);

  // 4. Information only.
  findings.uid = deps.getUid();
  findings.gid = deps.getGid();
  try {
    const stats = await run('statfs', () => fs.statfs(rootPath));
    findings.freeBytes = Number(stats.bavail) * Number(stats.bsize);
    findings.totalBytes = Number(stats.blocks) * Number(stats.bsize);
  } catch (err) {
    findings.statfsError = describe(err);
  }

  return {
    ok: checks.every((c) => c.ok),
    mountVerified,
    checks,
    findings,
    rootEntries,
  };
};

const runProbe = async (
  probeDir: string,
  found: Record<string, unknown>,
  deps: ValidationDeps,
): Promise<void> => {
  const { fs, run } = deps;
  const step = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    try {
      return await run(`probe: ${name}`, fn);
    } catch (err) {
      if (err instanceof ProbeStepError) throw err;
      throw new ProbeStepError(`${name} failed: ${describe(err)}`);
    }
  };
  const create = async (file: string, data: Buffer, sync: boolean) => {
    const handle = await fs.open(file, 'wx');
    try {
      await handle.writeFile(data);
      if (sync) await handle.sync();
    } finally {
      await handle.close();
    }
  };

  await step('create probe folder', () => fs.mkdir(probeDir));

  // Write, fsync, read back, compare.
  const data = randomBytes(64 * 1024);
  const original = path.join(probeDir, 'original');
  await step('write and fsync', () => create(original, data, true));
  const readBack = await step('read back', () => fs.readFile(original));
  if (sha256(readBack) !== sha256(data)) {
    throw new ProbeStepError('read back differs from what was written');
  }

  // link() must refuse to clobber: it is how a copy is placed.
  const linked = path.join(probeDir, 'linked');
  await step('link', () => fs.link(original, linked));
  const clobber = await run('probe: link onto existing', async () => {
    try {
      await fs.link(original, linked);
      return 'clobbered';
    } catch (err) {
      return errnoOf(err);
    }
  });
  if (clobber !== 'EEXIST') {
    throw new ProbeStepError(
      `link onto an existing name answered ${clobber}, expected EEXIST`,
    );
  }

  const renamed = path.join(probeDir, 'renamed');
  await step('rename', () => fs.rename(linked, renamed));

  // utimes: only the modified time is applied to copies.
  const target = new Date(
    Math.floor(deps.now().getTime() / 1000) * 1000 - 400 * 24 * 3600 * 1000,
  );
  await step('utimes', () => fs.utimes(renamed, target, target));
  const stat = await step('stat after utimes', () => fs.stat(renamed));
  if (Math.abs(stat.mtimeMs - target.getTime()) > 2000) {
    throw new ProbeStepError('utimes did not change the modified time');
  }
  found.utimesSupported = true;

  // Name length: 255 bytes must work; 256 is recorded, not required.
  await step('create 255-byte name', () =>
    create(path.join(probeDir, 'n'.repeat(255)), Buffer.from('x'), false),
  );
  found.maxNameLength = 255;
  found.rejects256ByteName = await run('probe: 256-byte name', async () => {
    try {
      await create(
        path.join(probeDir, 'n'.repeat(256)),
        Buffer.from('x'),
        false,
      );
      return false;
    } catch {
      return true;
    }
  });

  // Case sensitivity: recorded, not required.
  await step('create case variants', async () => {
    await create(path.join(probeDir, 'Case.txt'), Buffer.from('upper'), false);
    try {
      await create(
        path.join(probeDir, 'case.txt'),
        Buffer.from('lower'),
        false,
      );
      found.caseSensitive = true;
    } catch (err) {
      if (errnoOf(err) !== 'EEXIST') throw err;
      found.caseSensitive = false;
    }
  });

  // Names a Windows tree can contain.
  for (const name of ['with space.txt', 'trailing.dot.', 'ünïcode-日本.txt']) {
    await step(`create awkward name "${name}"`, () =>
      create(path.join(probeDir, name), Buffer.from('x'), false),
    );
  }
};
