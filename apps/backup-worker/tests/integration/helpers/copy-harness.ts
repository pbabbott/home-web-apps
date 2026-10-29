import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  createBackupJob,
  createHost,
  createSource,
  inventoryItems,
  listBackupEntries,
  upsertSourceConnection,
  type BackupCarveOut,
  type BackupEntry,
  type BackupJob,
  type BackupJobItem,
  type InventoryItem,
  type InventoryItemKind,
} from '@abbottland/homelab-db';
import { encryptSecret, type FakeDriver } from '@abbottland/source-access';
import { claimAndCopyNext, type RunOptions } from '../../../src/copy/run';
import { db } from '../../../src/db';
import { DESTINATION_ID, DESTINATION_PATH } from '../../jest.integration.setup';

export const HUMAN = { type: 'human' as const, id: 'brandon' };

const unique = () => Math.random().toString(36).slice(2, 10);

const sourceIds: string[] = [];
const hostIds: string[] = [];

export const sha256 = (content: Buffer | string): string =>
  createHash('sha256').update(content).digest('hex');

/** Deterministic, not repetitive, so a shifted or truncated copy is noticed. */
export const bytes = (length: number, seed = 1): Buffer => {
  const out = Buffer.alloc(length);
  let x = seed;

  for (let i = 0; i < length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out[i] = x >> 16;
  }

  return out;
};

/** Registers the destination row the setup file's id refers to. */
export const createDestinationRow = async (): Promise<void> => {
  const { rows } = await db.$client.query(
    `insert into hosts (name, ip_address) values ($1, '192.0.2.10') returning id`,
    [`copy-test-host-${DESTINATION_ID}`],
  );
  await db.$client.query(
    `insert into backup_destinations (id, name, host_id, connection_type, settings)
     values ($1, $2, $3, 'nfs', $4)`,
    [
      DESTINATION_ID,
      `copy-test-${DESTINATION_ID}`,
      rows[0].id,
      JSON.stringify({ exportPath: '/volume1/Test' }),
    ],
  );
};

export const deleteDestinationRow = async (): Promise<void> => {
  await db.$client.query('delete from audit_events where destination_id = $1', [
    DESTINATION_ID,
  ]);
  await db.$client.query('delete from backup_destinations where id = $1', [
    DESTINATION_ID,
  ]);
  await db.$client.query('delete from hosts where name = $1', [
    `copy-test-host-${DESTINATION_ID}`,
  ]);
};

/** Removes the sources made by a test (their jobs, items and entries cascade). */
export const cleanupWorld = async (): Promise<void> => {
  await db.$client.query(
    'delete from audit_events where source_id = any($1) or destination_id = $2',
    [sourceIds, DESTINATION_ID],
  );
  await db.$client.query('delete from sources where id = any($1)', [sourceIds]);
  await db.$client.query('delete from hosts where id = any($1)', [hostIds]);
  sourceIds.length = 0;
  hostIds.length = 0;
};

/** Empties the scratch destination between tests. */
export const resetDestination = (): void => {
  for (const name of fs.readdirSync(DESTINATION_PATH)) {
    fs.rmSync(path.join(DESTINATION_PATH, name), {
      recursive: true,
      force: true,
    });
  }
};

/** A source with a host and an SMB connection (real rows, real decryption). */
export const makeSource = async (): Promise<string> => {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  const host = await createHost(db, {
    name: `copy-host-${unique()}`,
    ipAddress: `10.${octet()}.${octet()}.${octet()}`,
    hostType: 'physical',
  });
  hostIds.push(host.id);
  const source = await createSource(db, {
    name: `copy-source-${unique()}`,
    hostId: host.id,
  });
  sourceIds.push(source.id);
  await upsertSourceConnection(db, {
    sourceId: source.id,
    connectionType: 'smb',
    username: 'tester',
    secretCiphertext: encryptSecret('pw'),
    settings: { shareMappings: [] },
    actor: HUMAN,
  });

  return source.id;
};

const makeInventoryItem = async (
  sourceId: string,
  rootPath: string,
  kind: InventoryItemKind,
): Promise<InventoryItem> => {
  const [row] = await db
    .insert(inventoryItems)
    .values({
      sourceId,
      kind,
      rootPath,
      normalizedRootPath: rootPath.toLowerCase(),
      displayName: rootPath,
      summary: 'test',
      recommendation: 'back_up',
      confidence: 'high',
      recommendationReason: 'test',
      evidence: {
        contentKinds: [],
        git: null,
        reproducible: 'unknown',
        sufficientInformation: true,
        observations: [],
        openQuestions: [],
      },
      decision: 'approved',
      decidedAt: new Date(),
      decidedBy: 'brandon',
    })
    .returning();

  return row;
};

export type ItemSpec = {
  /** Windows path of the inventory item, for example `C:\data\proj`. */
  rootPath: string;
  kind?: InventoryItemKind;
  /** Defaults to the mirror of the path (`C/data/proj`). */
  destRelPath?: string;
  carveOuts?: BackupCarveOut[];
  /** For a redundant nested item: the inventory root path of the covering item. */
  redundantIn?: string;
};

export type World = {
  sourceId: string;
  sourceDirName: string;
  job: BackupJob;
  items: Record<string, BackupJobItem>;
};

const mirror = (rootPath: string) =>
  rootPath.replace(':', '').replace(/\\/g, '/');

/**
 * A source, inventory items and a `planned` job for this worker's
 * destination. `items` are keyed by `rootPath`.
 */
export const makeWorld = async (
  specs: ItemSpec[],
  sourceDirName = `src-${unique()}`,
  maxAttempts?: number,
): Promise<World> => {
  const sourceId = await makeSource();
  const inventory = new Map<string, InventoryItem>();

  for (const spec of specs) {
    inventory.set(
      spec.rootPath,
      await makeInventoryItem(sourceId, spec.rootPath, spec.kind ?? 'file'),
    );
  }

  const job = await createBackupJob(
    db,
    {
      sourceId,
      destinationId: DESTINATION_ID,
      selection: { skipAlreadyCovered: true },
      sourceDirName,
      items: specs.map((spec) => {
        const inv = inventory.get(spec.rootPath) as InventoryItem;
        const covering = spec.redundantIn
          ? inventory.get(spec.redundantIn)
          : undefined;

        return {
          inventoryItemId: inv.id,
          kind: inv.kind,
          rootPath: inv.rootPath,
          normalizedRootPath: inv.normalizedRootPath,
          destRelPath: spec.destRelPath ?? mirror(spec.rootPath),
          carveOuts: spec.carveOuts,
          status: covering ? ('skipped' as const) : ('queued' as const),
          statusReason: covering ? 'redundant_nested' : undefined,
          coveredByInventoryItemId: covering?.id,
        };
      }),
    },
    HUMAN,
  );

  if (maxAttempts !== undefined) {
    await db.$client.query(
      'update backup_job_items set max_attempts = $2 where job_id = $1 and status = $3',
      [job.id, maxAttempts, 'queued'],
    );
  }

  const { rows } = await db.$client.query(
    `select id, inventory_item_id as "inventoryItemId", status, attempt_count as "attemptCount", last_error as "lastError" from backup_job_items where job_id = $1`,
    [job.id],
  );
  const items: Record<string, BackupJobItem> = {};

  for (const spec of specs) {
    const inv = inventory.get(spec.rootPath) as InventoryItem;

    items[spec.rootPath] = rows.find(
      (row) => row.inventoryItemId === inv.id,
    ) as BackupJobItem;
  }

  return { sourceId, sourceDirName, job, items };
};

export const itemRow = async (id: string) => {
  const { rows } = await db.$client.query(
    `select status, attempt_count as "attemptCount", max_attempts as "maxAttempts", last_error as "lastError", enumeration_complete as "enumerationComplete" from backup_job_items where id = $1`,
    [id],
  );

  return rows[0] as {
    status: string;
    attemptCount: number;
    maxAttempts: number;
    lastError: string | null;
    enumerationComplete: boolean;
  };
};

export const jobStatus = async (id: string): Promise<string> => {
  const { rows } = await db.$client.query(
    'select status from backup_jobs where id = $1',
    [id],
  );

  return rows[0].status;
};

export const entriesOf = (itemId: string): Promise<BackupEntry[]> =>
  listBackupEntries(db, { jobItemId: itemId, limit: 1000 });

/** Entries by relative path. */
export const entryMap = async (
  itemId: string,
): Promise<Record<string, BackupEntry>> =>
  Object.fromEntries(
    (await entriesOf(itemId)).map((entry) => [entry.relPath, entry]),
  );

export const expireLeases = async (jobId: string): Promise<void> => {
  await db.$client.query(
    "update backup_job_items set lease_expires_at = now() - interval '1 second' where job_id = $1 and status = 'in_progress'",
    [jobId],
  );
};

/** Skips a retry backoff. */
export const makeAvailable = async (jobId: string): Promise<void> => {
  await db.$client.query(
    "update backup_job_items set available_at = now() where job_id = $1 and status = 'queued'",
    [jobId],
  );
};

/**
 * Runs the worker's claim-and-copy until there is nothing left to claim.
 * With `skipBackoff` a requeued item is made available at once.
 */
export const runUntilIdle = async (
  jobId: string,
  options: RunOptions & { skipBackoff?: boolean } = {},
): Promise<string[]> => {
  const results: string[] = [];

  for (let i = 0; i < 30; i++) {
    const result = await claimAndCopyNext(options);

    results.push(
      result.kind === 'idle' ? `idle:${result.reason}` : result.kind,
    );
    if (result.kind === 'idle') {
      if (result.reason === 'retry_backoff' && options.skipBackoff) {
        await makeAvailable(jobId);
        continue;
      }
      break;
    }
    if (result.kind === 'backoff') break;
  }

  return results;
};

/** Runs one claim-and-copy per call; for steps a test wants to look at in between. */
export const runOnce = (options: RunOptions = {}) => claimAndCopyNext(options);

export type TreeNode =
  | { type: 'dir'; mtime: number }
  | { type: 'file'; mtime: number; size: number; sha256: string }
  | { type: 'symlink'; target: string };

/** Everything under `root`: type, size, hash and modified second, keyed by relative path. */
export const snapshot = (root: string): Record<string, TreeNode> => {
  const out: Record<string, TreeNode> = {};
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      const stat = fs.lstatSync(abs);

      if (stat.isSymbolicLink()) {
        out[rel] = { type: 'symlink', target: fs.readlinkSync(abs) };
      } else if (stat.isDirectory()) {
        out[rel] = { type: 'dir', mtime: Math.floor(stat.mtimeMs / 1000) };
        walk(abs);
      } else {
        out[rel] = {
          type: 'file',
          mtime: Math.floor(stat.mtimeMs / 1000),
          size: stat.size,
          sha256: sha256(fs.readFileSync(abs)),
        };
      }
    }
  };

  if (fs.existsSync(root)) walk(root);

  return out;
};

export const destPath = (...parts: string[]) =>
  path.join(DESTINATION_PATH, ...parts);

export const newId = () => randomUUID();

export type { FakeDriver };
