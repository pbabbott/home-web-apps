import { sql } from 'drizzle-orm';
import type { Database } from '../../client';
import { escapeLike } from '../shared';

export type KnownSkip = {
  path: string;
  reason: string;
  /** When the queue item that recorded the skip was completed. */
  skippedAt: Date;
  jobId: string;
};

export type ListKnownSkipsOptions = {
  sourceId: string;
  /** Only skips at or beneath this path (normalized). */
  normalizedPathPrefix?: string;
  limit?: number;
};

const LIST_KNOWN_SKIPS_DEFAULT_LIMIT = 200;
const LIST_KNOWN_SKIPS_MAX_LIMIT = 1000;

/**
 * Paths the agent has deliberately not explored, drawn from the `skipped`
 * lists that earlier jobs of the source stored on their queue items. Derived,
 * not a table of its own: a skip stays a per-run judgment that a later run may
 * revisit, never a persisted rule. A path skipped more than once (case
 * insensitively) appears once, with the newest reason. Ordered by path.
 */
export const listKnownSkips = async (
  db: Database,
  options: ListKnownSkipsOptions,
): Promise<KnownSkip[]> => {
  const dir = options.normalizedPathPrefix?.replace(/\\$/, '');
  const prefix = dir
    ? sql`and (lower(s.entry->>'path') = ${dir} or lower(s.entry->>'path') like ${`${escapeLike(dir)}\\%`} escape '!')`
    : sql``;
  const limit = Math.min(
    options.limit ?? LIST_KNOWN_SKIPS_DEFAULT_LIMIT,
    LIST_KNOWN_SKIPS_MAX_LIMIT,
  );

  const result = await db.execute<{
    path: string;
    reason: string;
    skipped_at: Date;
    job_id: string;
  }>(sql`
    select * from (
      select distinct on (lower(s.entry->>'path'))
        s.entry->>'path' as path,
        s.entry->>'reason' as reason,
        q.completed_at as skipped_at,
        q.job_id as job_id
      from discovery_queue_items q
      join discovery_jobs j on j.id = q.job_id
      cross join lateral jsonb_array_elements(q.result->'skipped') as s(entry)
      where j.source_id = ${options.sourceId}
        and q.result is not null
        and jsonb_typeof(q.result->'skipped') = 'array'
        ${prefix}
      order by lower(s.entry->>'path'), q.completed_at desc nulls last
    ) latest
    order by lower(path)
    limit ${limit}
  `);

  return result.rows.map((row) => ({
    path: row.path,
    reason: row.reason,
    skippedAt: new Date(row.skipped_at),
    jobId: row.job_id,
  }));
};
