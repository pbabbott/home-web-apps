import {
  createBackupDestination,
  createBackupJob,
  createSource,
  inventoryItems,
  type BackupDestination,
  type BackupJob,
  type BackupJobItem,
  type InventoryItem,
  type InventoryItemDecision,
  type InventoryItemKind,
  type PlannedBackupItem,
} from '@abbottland/homelab-db';
import { db } from '../../../src/db';

export const HUMAN = { type: 'human' as const, id: 'brandon' };
export const WORKER = { type: 'system' as const, id: 'worker-a' };

const sourceIds: string[] = [];
const destinationIds: string[] = [];

const unique = () => Math.random().toString(36).slice(2);

/**
 * Runs against the real local dev Postgres, so everything created here is
 * deleted afterwards. Audit events have no foreign keys and go first by id,
 * sources next (their backup jobs, items and entries cascade), destinations
 * last (jobs reference them with RESTRICT).
 */
export const cleanupBackupFixtures = async (): Promise<void> => {
  await db.$client.query(
    'delete from audit_events where source_id = any($1) or destination_id = any($2)',
    [sourceIds, destinationIds],
  );
  await db.$client.query('delete from sources where id = any($1)', [sourceIds]);
  await db.$client.query('delete from backup_destinations where id = any($1)', [
    destinationIds,
  ]);
  sourceIds.length = 0;
  destinationIds.length = 0;
};

export const makeSource = async (): Promise<string> => {
  const source = await createSource(db, { name: `backup-test-${unique()}` });
  sourceIds.push(source.id);

  return source.id;
};

export const makeDestination = async (
  overrides: { enabled?: boolean } = {},
): Promise<BackupDestination> => {
  const destination = await createBackupDestination(
    db,
    {
      name: `backup-dest-${unique()}`,
      settings: { server: '192.0.2.10', exportPath: '/volume1/Test' },
      ...overrides,
    },
    HUMAN,
  );
  destinationIds.push(destination.id);

  return destination;
};

export const makeInventoryItem = async (
  sourceId: string,
  path: string,
  options: { kind?: InventoryItemKind; decision?: InventoryItemDecision } = {},
): Promise<InventoryItem> => {
  const decision = options.decision ?? 'approved';
  const [row] = await db
    .insert(inventoryItems)
    .values({
      sourceId,
      kind: options.kind ?? 'file',
      rootPath: path,
      normalizedRootPath: path.toLowerCase(),
      displayName: path,
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
      decision,
      decidedAt: decision === 'pending' ? null : new Date(),
      decidedBy: decision === 'pending' ? null : 'brandon',
    })
    .returning();

  return row;
};

export const planned = (
  item: InventoryItem,
  overrides: Partial<PlannedBackupItem> = {},
): PlannedBackupItem => ({
  inventoryItemId: item.id,
  kind: item.kind,
  rootPath: item.rootPath,
  normalizedRootPath: item.normalizedRootPath,
  destRelPath: `test-source/${item.rootPath.replace(':', '').replace(/\\/g, '/')}`,
  status: 'queued',
  ...overrides,
});

/** A source with `fileCount` approved file inventory items, a destination and a planned job. */
export const makeJob = async (
  fileCount = 1,
  options: { destination?: BackupDestination; sourceId?: string } = {},
): Promise<{
  sourceId: string;
  destination: BackupDestination;
  job: BackupJob;
  inventory: InventoryItem[];
}> => {
  const sourceId = options.sourceId ?? (await makeSource());
  const destination = options.destination ?? (await makeDestination());
  const inventory: InventoryItem[] = [];
  for (let i = 0; i < fileCount; i += 1) {
    inventory.push(
      await makeInventoryItem(sourceId, `C:\\data\\file-${i}.txt`),
    );
  }
  const job = await createBackupJob(
    db,
    {
      sourceId,
      destinationId: destination.id,
      selection: { skipAlreadyCovered: true },
      sourceDirName: 'test-source',
      items: inventory.map((item) => planned(item)),
    },
    HUMAN,
  );

  return { sourceId, destination, job, inventory };
};

export const itemRow = async (id: string): Promise<BackupJobItem> => {
  const { rows } = await db.$client.query(
    'select id, status, attempt_count as "attemptCount", max_attempts as "maxAttempts", last_error as "lastError", claim_token as "claimToken" from backup_job_items where id = $1',
    [id],
  );

  return rows[0];
};

export const expireLease = async (id: string): Promise<void> => {
  await db.$client.query(
    "update backup_job_items set lease_expires_at = now() - interval '1 second' where id = $1",
    [id],
  );
};

export const auditCount = async (
  eventType: string,
  where: { backupJobId?: string; destinationId?: string },
): Promise<number> => {
  const { rows } = await db.$client.query(
    'select count(*)::int as n from audit_events where event_type = $1 and ($2::uuid is null or backup_job_id = $2) and ($3::uuid is null or destination_id = $3)',
    [eventType, where.backupJobId ?? null, where.destinationId ?? null],
  );

  return rows[0].n;
};

/** The SQLSTATE of a rejected statement, or undefined when it was accepted. */
export const sqlState = async (
  statement: string,
  params: unknown[] = [],
): Promise<string | undefined> => {
  try {
    await db.$client.query(statement, params);
  } catch (err) {
    return (err as { code?: string }).code;
  }

  return undefined;
};
