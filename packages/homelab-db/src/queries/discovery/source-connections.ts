import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  discoveryJobs,
  discoveryQueueItems,
  inventoryItems,
  sourceConnections,
  sources,
  type SourceConnection,
  type SourceConnectionSettings,
  type SourceConnectionType,
} from '../../schema/discovery';
import { insertAuditEvent, type Actor } from '../audit';
import { DiscoveryError } from '../shared';

export const getSourceConnection = async (
  db: Database,
  sourceId: string,
): Promise<SourceConnection | undefined> => {
  const [row] = await db
    .select()
    .from(sourceConnections)
    .where(eq(sourceConnections.sourceId, sourceId));

  return row;
};

export type UpsertSourceConnectionInput = {
  sourceId: string;
  connectionType: SourceConnectionType;
  username: string;
  domain?: string | null;
  /** Already encrypted. Omit on update to keep the stored secret. */
  secretCiphertext?: string;
  settings?: SourceConnectionSettings;
  actor: Actor;
};

/**
 * Creates or replaces a source's connection, and its audit event, in one
 * transaction. A changed connection invalidates the last test result. The
 * audit details name what changed but never include the secret.
 */
export const upsertSourceConnection = async (
  db: Database,
  input: UpsertSourceConnectionInput,
): Promise<SourceConnection> =>
  db.transaction(async (tx) => {
    const [source] = await tx
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.id, input.sourceId))
      .for('share');

    if (!source) throw new DiscoveryError('not_found', 'source not found');

    const t = sourceConnections;
    const [before] = await tx
      .select()
      .from(t)
      .where(eq(t.sourceId, input.sourceId))
      .for('update');

    if (!before && input.secretCiphertext === undefined) {
      throw new DiscoveryError(
        'conflict',
        'a password is required to create a connection',
      );
    }

    const values = {
      connectionType: input.connectionType,
      username: input.username,
      domain: input.domain ?? null,
      secretCiphertext: (input.secretCiphertext ?? before?.secretCiphertext)!,
      settings: input.settings ?? before?.settings ?? {},
      lastTestedAt: null,
      lastTestOk: null,
      lastTestError: null,
    };

    const [row] = await tx
      .insert(t)
      .values({ sourceId: input.sourceId, ...values })
      .onConflictDoUpdate({
        target: t.sourceId,
        set: { ...values, updatedAt: sql`now()` },
      })
      .returning();

    await insertAuditEvent(tx, {
      eventType: 'source_connection.updated',
      actor: input.actor,
      sourceId: input.sourceId,
      details: {
        created: !before,
        connectionType: row.connectionType,
        username: row.username,
        domain: row.domain,
        passwordChanged: input.secretCiphertext !== undefined,
      },
    });

    return row;
  });

export const deleteSourceConnection = async (
  db: Database,
  sourceId: string,
  actor: Actor,
): Promise<void> =>
  db.transaction(async (tx) => {
    const [row] = await tx
      .delete(sourceConnections)
      .where(eq(sourceConnections.sourceId, sourceId))
      .returning({ connectionType: sourceConnections.connectionType });

    if (!row) throw new DiscoveryError('not_found', 'connection not found');

    await insertAuditEvent(tx, {
      eventType: 'source_connection.deleted',
      actor,
      sourceId,
      details: { connectionType: row.connectionType },
    });
  });

export const recordSourceConnectionTest = async (
  db: Database,
  sourceId: string,
  result: { ok: true } | { ok: false; error: string },
): Promise<SourceConnection> => {
  const [row] = await db
    .update(sourceConnections)
    .set({
      lastTestedAt: sql`now()`,
      lastTestOk: result.ok,
      lastTestError: 'error' in result ? result.error : null,
    })
    .where(eq(sourceConnections.sourceId, sourceId))
    .returning();

  if (!row) throw new DiscoveryError('not_found', 'connection not found');

  return row;
};

/**
 * True if the source's discovery recorded any of these normalized paths: an
 * inventory item rooted there, or a path a worker skipped. Pass a path and
 * all its ancestors, so a file inside an inventoried folder qualifies. This
 * is what keeps file preview limited to things a reviewer is deciding on.
 */
export const isPathKnownToSource = async (
  db: Database,
  sourceId: string,
  normalizedPaths: string[],
): Promise<boolean> => {
  if (normalizedPaths.length === 0) return false;

  const paths = sql`array[${sql.join(
    normalizedPaths.map((p) => sql`${p}`),
    sql`, `,
  )}]::text[]`;

  const result = await db.execute<{ known: boolean }>(sql`
    select (
      exists (
        select 1 from ${inventoryItems} i
        where i.source_id = ${sourceId}
          and i.normalized_root_path = any(${paths})
      )
      or exists (
        select 1
        from ${discoveryQueueItems} q
        join ${discoveryJobs} j on j.id = q.job_id
        cross join lateral jsonb_array_elements(
          coalesce(q.result -> 'skipped', '[]'::jsonb)
        ) as skip
        where j.source_id = ${sourceId}
          and lower(skip ->> 'path') = any(${paths})
      )
    ) as known
  `);

  return result.rows[0]?.known === true;
};

/**
 * Name patterns (`*.exe`) a worker skipped directly under this directory, for
 * the source. A file matching one of them is something discovery decided
 * about, so it may be previewed.
 */
export const listSkippedGroupPatterns = async (
  db: Database,
  sourceId: string,
  normalizedDir: string,
): Promise<string[]> => {
  const result = await db.execute<{ pattern: string }>(sql`
    select distinct grp ->> 'pattern' as pattern
    from ${discoveryQueueItems} q
    join ${discoveryJobs} j on j.id = q.job_id
    cross join lateral jsonb_array_elements(
      coalesce(q.result -> 'skippedGroups', '[]'::jsonb)
    ) as grp
    where j.source_id = ${sourceId}
      and q.normalized_path = ${normalizedDir}
  `);

  return result.rows.map((row) => row.pattern);
};
