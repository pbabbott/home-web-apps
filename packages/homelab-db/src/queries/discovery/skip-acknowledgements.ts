import { and, asc, eq, or, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  discoveryJobs,
  discoveryQueueItems,
  skipAcknowledgements,
  type SkipAcknowledgement,
} from '../../schema/discovery';
import { insertAuditEvent, type Actor } from '../audit';
import { DiscoveryError, escapeLike, type Tx } from '../shared';

export type SkipInput = {
  path: string;
  normalizedPath: string;
  /** Set for a pattern skip, where `path` is the directory. */
  pattern?: string;
  actor: Actor;
};

const LIST_DEFAULT_LIMIT = 500;
const LIST_MAX_LIMIT = 1000;

const assertHuman = (actor: Actor, verb: string) => {
  if (actor.type !== 'human') {
    throw new DiscoveryError(
      'conflict',
      `only a human can ${verb} a skipped path`,
    );
  }
};

const sourceOfQueueItem = async (
  tx: Tx,
  queueItemId: string,
): Promise<{ sourceId: string; jobId: string }> => {
  const [queued] = await tx
    .select({
      jobId: discoveryQueueItems.jobId,
      sourceId: discoveryJobs.sourceId,
    })
    .from(discoveryQueueItems)
    .innerJoin(discoveryJobs, eq(discoveryJobs.id, discoveryQueueItems.jobId))
    .where(eq(discoveryQueueItems.id, queueItemId));

  if (!queued) throw new DiscoveryError('not_found', 'queue item not found');

  return queued;
};

/**
 * A human agrees with the agent's skip of a path (or pattern). Only a human
 * may: acknowledging is a review. Idempotent: acknowledging again returns
 * the existing row and writes no second audit event.
 */
export const acknowledgeSkip = async (
  db: Database,
  queueItemId: string,
  input: SkipInput,
): Promise<SkipAcknowledgement> => {
  assertHuman(input.actor, 'acknowledge');

  return db.transaction(async (tx) => {
    const { sourceId, jobId } = await sourceOfQueueItem(tx, queueItemId);
    const pattern = input.pattern ?? '';

    const [created] = await tx
      .insert(skipAcknowledgements)
      .values({
        sourceId,
        path: input.path,
        normalizedPath: input.normalizedPath,
        pattern,
        queueItemId,
        acknowledgedBy: input.actor.id ?? 'human',
      })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      const [existing] = await tx
        .select()
        .from(skipAcknowledgements)
        .where(
          and(
            eq(skipAcknowledgements.sourceId, sourceId),
            eq(skipAcknowledgements.normalizedPath, input.normalizedPath),
            eq(skipAcknowledgements.pattern, pattern),
          ),
        );

      return existing;
    }

    await insertAuditEvent(tx, {
      eventType: 'skip.acknowledged',
      actor: input.actor,
      sourceId,
      jobId,
      queueItemId,
      details: { path: input.path, ...(pattern ? { pattern } : {}) },
    });

    return created;
  });
};

/** Takes an acknowledgement back. 404 when there is none. Human only. */
export const unacknowledgeSkip = async (
  db: Database,
  queueItemId: string,
  input: SkipInput,
): Promise<void> => {
  assertHuman(input.actor, 'unacknowledge');

  await db.transaction(async (tx) => {
    const { sourceId, jobId } = await sourceOfQueueItem(tx, queueItemId);
    const pattern = input.pattern ?? '';

    const deleted = await tx
      .delete(skipAcknowledgements)
      .where(
        and(
          eq(skipAcknowledgements.sourceId, sourceId),
          eq(skipAcknowledgements.normalizedPath, input.normalizedPath),
          eq(skipAcknowledgements.pattern, pattern),
        ),
      )
      .returning({ id: skipAcknowledgements.id });

    if (deleted.length === 0) {
      throw new DiscoveryError('not_found', 'skip is not acknowledged');
    }

    await insertAuditEvent(tx, {
      eventType: 'skip.unacknowledged',
      actor: input.actor,
      sourceId,
      jobId,
      queueItemId,
      details: { path: input.path, ...(pattern ? { pattern } : {}) },
    });
  });
};

export type ListSkipAcknowledgementsOptions = {
  sourceId: string;
  /** Only acknowledgements at or beneath this path (normalized). */
  normalizedPathPrefix?: string;
  limit?: number;
};

/** A source's acknowledgements, ordered by path then pattern. */
export const listSkipAcknowledgements = async (
  db: Database,
  options: ListSkipAcknowledgementsOptions,
): Promise<SkipAcknowledgement[]> => {
  const t = skipAcknowledgements;
  const dir = options.normalizedPathPrefix?.replace(/\\$/, '');
  const conditions: (SQL | undefined)[] = [eq(t.sourceId, options.sourceId)];

  if (dir) {
    conditions.push(
      or(
        eq(t.normalizedPath, dir),
        sql`${t.normalizedPath} like ${`${escapeLike(dir)}\\%`} escape '!'`,
      ),
    );
  }

  return db
    .select()
    .from(t)
    .where(and(...conditions))
    .orderBy(asc(t.normalizedPath), asc(t.pattern))
    .limit(Math.min(options.limit ?? LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT));
};
