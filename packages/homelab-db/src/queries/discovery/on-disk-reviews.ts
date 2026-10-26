import { and, asc, eq, or, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  discoveryQueueItems,
  onDiskReviews,
  type OnDiskReview,
} from '../../schema/discovery';
import { insertAuditEvent, type Actor } from '../audit';
import { DiscoveryError, escapeLike } from '../shared';
import { assertHuman, sourceOfQueueItem } from './review-helpers';

const LIST_DEFAULT_LIMIT = 500;
const LIST_MAX_LIMIT = 1000;

/** The directory a queue item covers, as the key an on-disk review is kept under. */
const directoryOf = async (
  db: Pick<Database, 'select'>,
  queueItemId: string,
): Promise<{ path: string; normalizedPath: string }> => {
  const [item] = await db
    .select({
      path: discoveryQueueItems.path,
      normalizedPath: discoveryQueueItems.normalizedPath,
    })
    .from(discoveryQueueItems)
    .where(eq(discoveryQueueItems.id, queueItemId));

  if (!item) throw new DiscoveryError('not_found', 'queue item not found');

  return item;
};

/**
 * A human says they reviewed what is on disk in a queue item's directory.
 * Only a human may. Idempotent: reviewing again returns the existing row and
 * writes no second audit event.
 */
export const reviewOnDisk = async (
  db: Database,
  queueItemId: string,
  actor: Actor,
): Promise<OnDiskReview> => {
  assertHuman(actor, 'review a directory on disk');

  return db.transaction(async (tx) => {
    const { sourceId, jobId } = await sourceOfQueueItem(tx, queueItemId);
    const directory = await directoryOf(tx, queueItemId);

    const [created] = await tx
      .insert(onDiskReviews)
      .values({
        sourceId,
        path: directory.path,
        normalizedPath: directory.normalizedPath,
        queueItemId,
        reviewedBy: actor.id ?? 'human',
      })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      const [existing] = await tx
        .select()
        .from(onDiskReviews)
        .where(
          and(
            eq(onDiskReviews.sourceId, sourceId),
            eq(onDiskReviews.normalizedPath, directory.normalizedPath),
          ),
        );

      return existing;
    }

    await insertAuditEvent(tx, {
      eventType: 'on_disk.reviewed',
      actor,
      sourceId,
      jobId,
      queueItemId,
      details: { path: directory.path },
    });

    return created;
  });
};

/** Takes a review back. `not_found` when there is none. Human only. */
export const unreviewOnDisk = async (
  db: Database,
  queueItemId: string,
  actor: Actor,
): Promise<void> => {
  assertHuman(actor, 'take back an on-disk review');

  await db.transaction(async (tx) => {
    const { sourceId, jobId } = await sourceOfQueueItem(tx, queueItemId);
    const directory = await directoryOf(tx, queueItemId);

    const deleted = await tx
      .delete(onDiskReviews)
      .where(
        and(
          eq(onDiskReviews.sourceId, sourceId),
          eq(onDiskReviews.normalizedPath, directory.normalizedPath),
        ),
      )
      .returning({ id: onDiskReviews.id });

    if (deleted.length === 0) {
      throw new DiscoveryError('not_found', 'directory is not reviewed');
    }

    await insertAuditEvent(tx, {
      eventType: 'on_disk.unreviewed',
      actor,
      sourceId,
      jobId,
      queueItemId,
      details: { path: directory.path },
    });
  });
};

/** The review of one directory, or undefined. */
export const getOnDiskReview = async (
  db: Database,
  sourceId: string,
  normalizedPath: string,
): Promise<OnDiskReview | undefined> => {
  const [row] = await db
    .select()
    .from(onDiskReviews)
    .where(
      and(
        eq(onDiskReviews.sourceId, sourceId),
        eq(onDiskReviews.normalizedPath, normalizedPath),
      ),
    );

  return row;
};

/** Normalized paths of every reviewed directory at or beneath a path, with no page limit. */
export const listOnDiskReviewedPaths = async (
  db: Database,
  sourceId: string,
  normalizedPathPrefix: string,
): Promise<string[]> => {
  const t = onDiskReviews;
  const dir = normalizedPathPrefix.replace(/\\$/, '');
  const rows = await db
    .select({ path: t.normalizedPath })
    .from(t)
    .where(
      and(
        eq(t.sourceId, sourceId),
        or(
          eq(t.normalizedPath, dir),
          sql`${t.normalizedPath} like ${`${escapeLike(dir)}\\%`} escape '!'`,
        ),
      ),
    );

  return rows.map((row) => row.path);
};

export type ListOnDiskReviewsOptions = {
  sourceId: string;
  /** Only reviews at or beneath this path (normalized). */
  normalizedPathPrefix?: string;
  limit?: number;
};

/** A source's on-disk reviews, ordered by path. */
export const listOnDiskReviews = async (
  db: Database,
  options: ListOnDiskReviewsOptions,
): Promise<OnDiskReview[]> => {
  const t = onDiskReviews;
  const dir = options.normalizedPathPrefix?.replace(/\\$/, '');

  return db
    .select()
    .from(t)
    .where(
      and(
        eq(t.sourceId, options.sourceId),
        dir
          ? or(
              eq(t.normalizedPath, dir),
              sql`${t.normalizedPath} like ${`${escapeLike(dir)}\\%`} escape '!'`,
            )
          : undefined,
      ),
    )
    .orderBy(asc(t.normalizedPath))
    .limit(Math.min(options.limit ?? LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT));
};
