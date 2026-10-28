import { and, asc, eq, gt, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { Database } from '../../client';
import {
  backupEntries,
  backupJobItems,
  type BackupEntry,
  type BackupEntryIssueKind,
  type BackupEntryStatus,
  type BackupEntryType,
} from '../../schema/backup';
import type { Tx } from '../shared';
import {
  BackupError,
  activeItemClaim,
  backupJobIsActive,
  itemClaimMissError,
} from './shared';

/** Source metadata captured before the file is read; no owner or ACL. */
export type BackupEntrySourceMetadata = {
  srcCreatedAt?: Date | null;
  srcModifiedAt?: Date | null;
  srcAccessedAt?: Date | null;
  srcChangedAt?: Date | null;
  srcAttributes?: string | null;
  srcStreams?: { name: string; size: number }[] | null;
  srcZoneIdentifier?: string | null;
};

export type BackupEntryInput = BackupEntrySourceMetadata & {
  relPath: string;
  normalizedRelPath: string;
  entryType: BackupEntryType;
  /** Enumeration records `pending`; a listing problem is recorded as `failed` or `not_followed`. */
  status?: Extract<BackupEntryStatus, 'pending' | 'failed' | 'not_followed'>;
  issueKind?: BackupEntryIssueKind | null;
  message?: string | null;
  sizeBytes?: number | null;
};

const UPSERT_CHUNK = 500;
/** Characters of a `Zone.Identifier` stream kept. */
export const ZONE_IDENTIFIER_MAX_CHARS = 4096;

const capZone = (value: string | null | undefined) =>
  value == null ? null : value.slice(0, ZONE_IDENTIFIER_MAX_CHARS);

/** A verified entry keeps its value; any other follows the new listing. */
const keepIfVerified = (column: AnyPgColumn, name: string) =>
  sql`case when ${backupEntries.status} = 'verified' then ${column} else excluded.${sql.raw(name)} end`;

/**
 * Upserts enumerated entries in batches. A retry re-enumerates and upserts,
 * so it never duplicates a row. Rules: a `verified` entry is never changed
 * (its status, hash and destination path are the proof); `src_*` metadata is
 * first-capture-wins (a retry cannot overwrite what was recorded before the
 * file was first read); everything else follows the new listing, so a
 * previously `failed` entry becomes `pending` again and is retried. The batch
 * is sorted by path so overlapping batches lock rows in one order. Guarded by
 * the item's live claim. Returns how many rows were written.
 */
export const upsertBackupEntries = async (
  db: Database,
  jobItemId: string,
  input: { claimToken: string; entries: BackupEntryInput[] },
): Promise<number> => {
  const unique = [
    ...new Map(input.entries.map((e) => [e.normalizedRelPath, e])).values(),
  ].sort((a, b) =>
    a.normalizedRelPath < b.normalizedRelPath
      ? -1
      : a.normalizedRelPath > b.normalizedRelPath
        ? 1
        : 0,
  );

  return db.transaction(async (tx) => {
    const [claim] = await tx
      .select({ id: backupJobItems.id })
      .from(backupJobItems)
      .where(activeItemClaim(jobItemId, input.claimToken))
      .for('share');

    if (!claim) throw await itemClaimMissError(tx, jobItemId);

    const t = backupEntries;
    const coalesceCaptured = (name: string, column: unknown) =>
      sql`coalesce(${column}, excluded.${sql.raw(name)})`;

    for (let i = 0; i < unique.length; i += UPSERT_CHUNK) {
      await tx
        .insert(t)
        .values(
          unique.slice(i, i + UPSERT_CHUNK).map((e) => ({
            jobItemId,
            relPath: e.relPath,
            normalizedRelPath: e.normalizedRelPath,
            entryType: e.entryType,
            status: e.status ?? 'pending',
            issueKind: e.issueKind ?? null,
            message: e.message ?? null,
            sizeBytes: e.sizeBytes ?? null,
            srcCreatedAt: e.srcCreatedAt ?? null,
            srcModifiedAt: e.srcModifiedAt ?? null,
            srcAccessedAt: e.srcAccessedAt ?? null,
            srcChangedAt: e.srcChangedAt ?? null,
            srcAttributes: e.srcAttributes ?? null,
            srcStreams: e.srcStreams ?? null,
            srcZoneIdentifier: capZone(e.srcZoneIdentifier),
          })),
        )
        .onConflictDoUpdate({
          target: [t.jobItemId, t.normalizedRelPath],
          set: {
            relPath: keepIfVerified(t.relPath, 'rel_path'),
            entryType: keepIfVerified(t.entryType, 'entry_type'),
            status: keepIfVerified(t.status, 'status'),
            issueKind: keepIfVerified(t.issueKind, 'issue_kind'),
            message: keepIfVerified(t.message, 'message'),
            sizeBytes: sql`case when ${t.status} = 'verified' then ${t.sizeBytes} else coalesce(excluded.size_bytes, ${t.sizeBytes}) end`,
            srcCreatedAt: coalesceCaptured('src_created_at', t.srcCreatedAt),
            srcModifiedAt: coalesceCaptured('src_modified_at', t.srcModifiedAt),
            srcAccessedAt: coalesceCaptured('src_accessed_at', t.srcAccessedAt),
            srcChangedAt: coalesceCaptured('src_changed_at', t.srcChangedAt),
            srcAttributes: coalesceCaptured('src_attributes', t.srcAttributes),
            srcStreams: coalesceCaptured('src_streams', t.srcStreams),
            srcZoneIdentifier: coalesceCaptured(
              'src_zone_identifier',
              t.srcZoneIdentifier,
            ),
            updatedAt: sql`now()`,
          },
        });
    }

    return unique.length;
  });
};

/** The entry's owning item must hold a live claim on an active job. */
const entryClaimGuard = (entryId: number, claimToken: string) =>
  and(
    eq(backupEntries.id, entryId),
    sql`exists (select 1 from ${backupJobItems} where ${backupJobItems.id} = ${backupEntries.jobItemId} and ${backupJobItems.status} = 'in_progress' and ${backupJobItems.claimToken} = ${claimToken} and ${backupJobItems.leaseExpiresAt} > now() and ${backupJobIsActive(backupJobItems.jobId)})`,
  );

const entryMissError = async (
  db: Database | Tx,
  entryId: number,
): Promise<BackupError> => {
  const [row] = await db
    .select({ id: backupEntries.id })
    .from(backupEntries)
    .where(eq(backupEntries.id, entryId));

  if (!row) return new BackupError('not_found', 'backup entry not found');

  return new BackupError(
    'conflict',
    'claim is no longer valid (wrong token, lease expired, or item not in progress)',
  );
};

/**
 * Records the source metadata of an entry, filling only what is not recorded
 * yet. Capture happens before the file is read (reading changes its access
 * time on the source), and a later attempt must not replace the originals.
 */
export const captureBackupEntryMetadata = async (
  db: Database,
  entryId: number,
  input: { claimToken: string; metadata: BackupEntrySourceMetadata },
): Promise<BackupEntry> => {
  const t = backupEntries;
  const m = input.metadata;

  const [row] = await db
    .update(t)
    .set({
      srcCreatedAt: sql`coalesce(${t.srcCreatedAt}, ${m.srcCreatedAt ?? null})`,
      srcModifiedAt: sql`coalesce(${t.srcModifiedAt}, ${m.srcModifiedAt ?? null})`,
      srcAccessedAt: sql`coalesce(${t.srcAccessedAt}, ${m.srcAccessedAt ?? null})`,
      srcChangedAt: sql`coalesce(${t.srcChangedAt}, ${m.srcChangedAt ?? null})`,
      srcAttributes: sql`coalesce(${t.srcAttributes}, ${m.srcAttributes ?? null})`,
      srcStreams: sql`coalesce(${t.srcStreams}, ${m.srcStreams ? JSON.stringify(m.srcStreams) : null}::jsonb)`,
      srcZoneIdentifier: sql`coalesce(${t.srcZoneIdentifier}, ${capZone(m.srcZoneIdentifier)})`,
      updatedAt: sql`now()`,
    })
    .where(entryClaimGuard(entryId, input.claimToken))
    .returning();

  if (!row) throw await entryMissError(db, entryId);

  return row;
};

export type BackupEntryResult = {
  status: BackupEntryStatus;
  issueKind?: BackupEntryIssueKind | null;
  message?: string | null;
  sizeBytes?: number | null;
  sha256?: string | null;
  destRelPath?: string | null;
};

/**
 * Records the outcome of one entry (verified with its hash and destination
 * path, or failed with an issue kind). `verified` stamps `verified_at`. A
 * verified entry is final: repeating `verified` answers the stored row,
 * anything else conflicts. Guarded by the item's live claim.
 */
export const recordBackupEntryResult = async (
  db: Database,
  entryId: number,
  input: { claimToken: string; attempt?: number; result: BackupEntryResult },
): Promise<BackupEntry> => {
  const t = backupEntries;
  const r = input.result;

  const [row] = await db
    .update(t)
    .set({
      status: r.status,
      issueKind: r.issueKind ?? null,
      message: r.message ?? null,
      ...(r.sizeBytes !== undefined ? { sizeBytes: r.sizeBytes } : {}),
      sha256: r.sha256 ?? null,
      destRelPath: r.destRelPath ?? null,
      verifiedAt: r.status === 'verified' ? sql`now()` : null,
      ...(input.attempt !== undefined ? { attempt: input.attempt } : {}),
      updatedAt: sql`now()`,
    })
    .where(
      and(
        entryClaimGuard(entryId, input.claimToken),
        sql`${t.status} <> 'verified'`,
      ),
    )
    .returning();

  if (row) return row;

  const [existing] = await db.select().from(t).where(eq(t.id, entryId));
  if (existing?.status === 'verified' && r.status === 'verified') {
    return existing;
  }
  if (existing?.status === 'verified') {
    throw new BackupError('conflict', 'entry is already verified');
  }

  throw await entryMissError(db, entryId);
};

export type ListBackupEntriesOptions = {
  jobItemId: string;
  status?: BackupEntryStatus;
  issueKind?: BackupEntryIssueKind;
  /** Keyset cursor: the id of the last entry of the previous page. */
  after?: number;
  limit?: number;
};

const LIST_ENTRIES_DEFAULT_LIMIT = 200;
const LIST_ENTRIES_MAX_LIMIT = 1000;

/** Ordered by id (insertion order), so paging is stable while entries change status. */
export const listBackupEntries = async (
  db: Database | Tx,
  options: ListBackupEntriesOptions,
): Promise<BackupEntry[]> => {
  const t = backupEntries;

  return db
    .select()
    .from(t)
    .where(
      and(
        eq(t.jobItemId, options.jobItemId),
        options.status ? eq(t.status, options.status) : undefined,
        options.issueKind ? eq(t.issueKind, options.issueKind) : undefined,
        options.after !== undefined ? gt(t.id, options.after) : undefined,
      ),
    )
    .orderBy(asc(t.id))
    .limit(
      Math.min(
        options.limit ?? LIST_ENTRIES_DEFAULT_LIMIT,
        LIST_ENTRIES_MAX_LIMIT,
      ),
    );
};

export type BackupItemEntryCounts = Record<BackupEntryStatus, number> & {
  /** Bytes of verified file entries. */
  verifiedBytes: number;
};

/** Entry counts of one job item, derived from its entries. */
export const getBackupEntryCounts = async (
  db: Database | Tx,
  jobItemId: string,
): Promise<BackupItemEntryCounts> => {
  const t = backupEntries;
  const rows = await db
    .select({
      status: t.status,
      count: sql<number>`count(*)::int`,
      bytes: sql<number>`coalesce(sum(${t.sizeBytes}) filter (where ${t.entryType} = 'file'), 0)::float8`,
    })
    .from(t)
    .where(eq(t.jobItemId, jobItemId))
    .groupBy(t.status);

  const counts: BackupItemEntryCounts = {
    pending: 0,
    verified: 0,
    failed: 0,
    not_followed: 0,
    verifiedBytes: 0,
  };
  for (const row of rows) {
    counts[row.status] = row.count;
    if (row.status === 'verified') counts.verifiedBytes = row.bytes;
  }

  return counts;
};
