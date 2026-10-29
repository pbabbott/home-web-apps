import fsPromises from 'fs/promises';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  defaultValidationDeps,
  validateDestination,
  ROOT_ENTRIES_CAP,
  type ValidationDeps,
  type ValidationFs,
} from '../../src/destination/validate';
import type { MountEntry } from '../../src/destination/mounts';

const host = { id: 'h', name: 'nas', ipAddress: '192.168.4.124' };
const settings = { exportPath: '/volume1/Dump' };

let tmp: string;
let mountPath: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-validate-'));
  mountPath = path.join(tmp, 'mount');
  fs.mkdirSync(mountPath);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const nfsMount = (over: Partial<MountEntry> = {}): MountEntry => ({
  device: '192.168.4.124:/volume1/Dump',
  mountPoint: mountPath,
  fsType: 'nfs4',
  options: ['rw', 'hard'],
  ...over,
});

const deps = (over: Partial<ValidationDeps> = {}): ValidationDeps => ({
  ...defaultValidationDeps(),
  readMounts: async () => [nfsMount()],
  ...over,
});

const withFs = (over: Partial<ValidationFs>): ValidationFs => ({
  ...fsPromises,
  ...over,
});

const input = (
  rootDir: string | null = null,
  mountCheck: 'nfs' | 'none' = 'nfs',
) => ({
  destination: { host, settings, rootDir },
  mountPath,
  mountCheck,
});

/** Every path under `dir`, relative, so before/after can be compared. */
const tree = (dir: string): string[] =>
  fs.readdirSync(dir, { recursive: true }).map(String).sort();

const failedCheck = (v: {
  checks?: { name: string; ok: boolean; message?: string }[];
}) => v.checks?.find((c) => !c.ok);

describe('validateDestination', () => {
  it('passes for a good NFS mount and reports findings', async () => {
    const v = await validateDestination(input(), deps());

    expect(v.ok).toBe(true);
    expect(v.mountVerified).toBe(true);
    expect(v.checks?.map((c) => c.name)).toEqual(['mount', 'root', 'probe']);
    expect(v.findings).toMatchObject({
      utimesSupported: true,
      maxNameLength: 255,
      caseSensitive: true,
    });
    expect(typeof v.findings?.freeBytes).toBe('number');
    expect(v.findings).toHaveProperty('uid');
    expect(v.findings).toHaveProperty('gid');
  });

  it('fails when the path is not an NFS filesystem', async () => {
    const v = await validateDestination(
      input(),
      deps({ readMounts: async () => [nfsMount({ fsType: 'ext4' })] }),
    );

    expect(v.ok).toBe(false);
    expect(failedCheck(v)).toMatchObject({ name: 'mount' });
    expect(failedCheck(v)?.message).toMatch(/ext4/);
    expect(v.rootEntries).toBeUndefined();
  });

  it('fails for the wrong server:exportPath and writes nothing', async () => {
    const v = await validateDestination(
      input(),
      deps({
        readMounts: async () => [
          nfsMount({ device: '192.168.4.124:/volume1/Media' }),
        ],
      }),
    );

    expect(failedCheck(v)?.message).toMatch(/volume1\/Media/);
    expect(tree(mountPath)).toEqual([]);
  });

  it('fails when the path is not a mount point', async () => {
    const v = await validateDestination(
      input(),
      deps({ readMounts: async () => [] }),
    );
    expect(failedCheck(v)?.message).toMatch(/not a mount point/);
  });

  it('skips the mount check for "none" and records mountVerified: false', async () => {
    const v = await validateDestination(
      input(null, 'none'),
      deps({ readMounts: async () => [] }),
    );

    expect(v.ok).toBe(true);
    expect(v.mountVerified).toBe(false);
  });

  it('refuses a root_dir that is a symlink', async () => {
    const elsewhere = path.join(tmp, 'elsewhere');
    fs.mkdirSync(elsewhere);
    fs.symlinkSync(elsewhere, path.join(mountPath, 'link'));

    const v = await validateDestination(input('link'), deps());

    expect(failedCheck(v)).toMatchObject({ name: 'root' });
    expect(failedCheck(v)?.message).toMatch(/symbolic link/);
    expect(tree(elsewhere)).toEqual([]);
  });

  it('refuses a symlink in the middle of root_dir', async () => {
    const elsewhere = path.join(tmp, 'elsewhere');
    fs.mkdirSync(elsewhere);
    fs.symlinkSync(elsewhere, path.join(mountPath, 'a'));

    const v = await validateDestination(input('a/b'), deps());

    expect(failedCheck(v)?.message).toMatch(/symbolic link/);
    expect(tree(elsewhere)).toEqual([]);
  });

  it('refuses a root_dir that escapes the mount', async () => {
    const v = await validateDestination(input('../outside'), deps());
    expect(failedCheck(v)?.message).toMatch(/escapes/);
  });

  it('fails when the mount path does not exist', async () => {
    const v = await validateDestination(
      { ...input(null, 'none'), mountPath: path.join(tmp, 'missing') },
      deps(),
    );
    expect(failedCheck(v)).toMatchObject({ name: 'root' });
  });

  it('creates a missing root_dir', async () => {
    const v = await validateDestination(input('backups/exodus'), deps());

    expect(v.ok).toBe(true);
    expect(
      fs.statSync(path.join(mountPath, 'backups', 'exodus')).isDirectory(),
    ).toBe(true);
  });

  it('lists the names under the root, without probe and staging folders', async () => {
    fs.mkdirSync(path.join(mountPath, 'alpha-centauri'));
    fs.writeFileSync(path.join(mountPath, 'junk.txt'), 'x');
    fs.mkdirSync(path.join(mountPath, '.exodus-staging'));
    fs.mkdirSync(path.join(mountPath, '.exodus-probe-old'));

    const v = await validateDestination(input(), deps());

    expect(v.rootEntries).toEqual(['alpha-centauri', 'junk.txt']);
  });

  it('lists under root_dir, not the mount root', async () => {
    fs.mkdirSync(path.join(mountPath, 'sub'));
    fs.writeFileSync(path.join(mountPath, 'sub', 'inner'), 'x');
    fs.writeFileSync(path.join(mountPath, 'outer'), 'x');

    const v = await validateDestination(input('sub'), deps());

    expect(v.rootEntries).toEqual(['inner']);
  });

  it('caps the listing and says how many there were', async () => {
    const names = Array.from(
      { length: ROOT_ENTRIES_CAP + 50 },
      (_, i) => `f${i}`,
    );
    const v = await validateDestination(
      input(),
      deps({
        fs: withFs({
          readdir: (async (p: string, ...rest: unknown[]) =>
            p === mountPath
              ? names
              : (fsPromises.readdir as Function)(p, ...rest)) as never,
        }),
      }),
    );

    expect(v.rootEntries).toHaveLength(ROOT_ENTRIES_CAP);
    expect(v.findings?.rootEntriesTruncated).toBe(ROOT_ENTRIES_CAP + 50);
  });

  it('removes the probe folder and leaves the root as it found it', async () => {
    fs.writeFileSync(path.join(mountPath, 'keep.txt'), 'x');
    const before = tree(mountPath);

    const v = await validateDestination(input(), deps());

    expect(v.ok).toBe(true);
    expect(tree(mountPath)).toEqual(before);
  });

  describe('probe failures', () => {
    const probeFails = (over: Partial<ValidationFs>) =>
      validateDestination(input(), deps({ fs: withFs(over) }));

    it('fails when writing fails, and still removes the probe folder', async () => {
      const v = await probeFails({
        open: (async () => {
          throw Object.assign(new Error('read-only file system'), {
            code: 'EROFS',
          });
        }) as never,
      });

      expect(failedCheck(v)).toMatchObject({ name: 'probe' });
      expect(failedCheck(v)?.message).toMatch(/EROFS/);
      expect(tree(mountPath)).toEqual([]);
    });

    it('fails when read-back differs', async () => {
      const v = await probeFails({
        readFile: (async () => Buffer.from('different')) as never,
      });

      expect(failedCheck(v)?.message).toMatch(/read back differs/);
      expect(tree(mountPath)).toEqual([]);
    });

    it('fails when link() would clobber', async () => {
      let calls = 0;
      const v = await probeFails({
        link: (async (a: string, b: string) => {
          calls += 1;
          if (calls === 1) return fsPromises.link(a, b);
        }) as never,
      });

      expect(failedCheck(v)?.message).toMatch(/expected EEXIST/);
      expect(tree(mountPath)).toEqual([]);
    });

    it('fails when link() is unsupported', async () => {
      const v = await probeFails({
        link: (async () => {
          throw Object.assign(new Error('operation not permitted'), {
            code: 'EPERM',
          });
        }) as never,
      });

      expect(failedCheck(v)?.message).toMatch(/link failed: EPERM/);
    });

    it('fails when rename fails', async () => {
      const v = await probeFails({
        rename: (async () => {
          throw Object.assign(new Error('nope'), { code: 'EACCES' });
        }) as never,
      });

      expect(failedCheck(v)?.message).toMatch(/rename failed: EACCES/);
      expect(tree(mountPath)).toEqual([]);
    });

    it('fails when utimes does not change the modified time', async () => {
      const v = await probeFails({ utimes: (async () => undefined) as never });

      expect(failedCheck(v)?.message).toMatch(/utimes did not change/);
    });

    it('reports a probe folder that cannot be removed', async () => {
      const v = await probeFails({
        rm: (async () => {
          throw Object.assign(new Error('stale'), { code: 'ESTALE' });
        }) as never,
      });

      expect(v.ok).toBe(false);
      expect(v.checks?.find((c) => c.name === 'probe_cleanup')?.ok).toBe(false);
    });
  });

  it('records a case-insensitive destination without failing', async () => {
    const v = await validateDestination(
      input(),
      deps({
        fs: withFs({
          open: (async (p: string, flags: string) => {
            if (path.basename(p) === 'case.txt') {
              throw Object.assign(new Error('exists'), { code: 'EEXIST' });
            }
            return fsPromises.open(p, flags);
          }) as never,
        }),
      }),
    );

    expect(v.ok).toBe(true);
    expect(v.findings?.caseSensitive).toBe(false);
  });

  it('runs every destination call through the watchdog hook', async () => {
    const seen: string[] = [];
    await validateDestination(
      input(),
      deps({
        run: (async (op: string, fn: () => Promise<unknown>) => {
          seen.push(op);
          return fn();
        }) as never,
      }),
    );

    expect(seen).toEqual(
      expect.arrayContaining([
        'read mounts',
        'list root',
        'probe: write and fsync',
      ]),
    );
  });
});
