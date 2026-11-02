'use server';

import type {
  DirectoryListing,
  OnDiskReview,
  SkippedGroupMatches,
} from '../homelab-api';
import { type ActionResult, send, post } from './request';

/** The entries in a queue item's directory that one of its skipped patterns matched. */
export async function listSkippedGroupMatches(
  queueItemId: string,
  pattern: string,
): Promise<ActionResult<SkippedGroupMatches>> {
  return send<SkippedGroupMatches>(
    'GET',
    `/queue-items/${queueItemId}/skipped-group-matches?${new URLSearchParams({ pattern })}`,
  );
}

/** A queue item's directory as it is on the source, each entry marked by how it is covered. */
export async function listDirectoryOnDisk(
  queueItemId: string,
): Promise<ActionResult<DirectoryListing>> {
  return send<DirectoryListing>(
    'GET',
    `/queue-items/${queueItemId}/directory-listing`,
  );
}

/** A human says they reviewed what is on disk in the queue item's directory. Sent as the default (human) actor. */
export async function reviewOnDisk(
  queueItemId: string,
): Promise<ActionResult<OnDiskReview>> {
  return post<OnDiskReview>(`/queue-items/${queueItemId}/on-disk-review`);
}

/** Takes that review back. */
export async function unreviewOnDisk(
  queueItemId: string,
): Promise<ActionResult> {
  return send('DELETE', `/queue-items/${queueItemId}/on-disk-review`);
}
