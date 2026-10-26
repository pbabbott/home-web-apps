import * as discoveryService from '../../services/discovery';
import { actorOf } from '../../lib/actor';
import { handle } from './handle';
import type { Operation } from '../operation';
import type {
  OnDiskReviewListQuery,
  QueueItemIdParams,
  SourceIdParams,
} from '../../schemas/discovery';

// Does: let a human record that they reviewed what is on disk in a queue item's directory.
// Who: human only (REST). Deliberately no MCP tool.
export const reviewOnDiskOperation = {
  summary: 'Acknowledge the on-disk contents of a directory',
  description:
    'Records that a human reviewed what is actually in the queue item’s directory on the source (the “On disk” section). Kept per source and directory path, so it holds for later jobs that visit the same directory, and it does not expire when the contents change. Needed, with every skip reviewed and no inventory decision pending, for a directory’s `reviewed` flag. Idempotent. Writes an `on_disk.reviewed` audit event the first time. Only a human actor may (409 otherwise).',
  hud: '/exodus/jobs/[id]/directories/[itemId]',
} satisfies Operation;

export const reviewOnDisk = handle(
  'POST /queue-items/:id/on-disk-review',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    res.status(201).json(await discoveryService.reviewOnDisk(id, actorOf(res)));
  },
);

// Does: take that review back.
// Who: human only (REST).
export const unreviewOnDiskOperation = {
  summary: 'Remove the on-disk acknowledgement of a directory',
  description:
    'Takes back the acknowledgement. 404 when there is none. Writes an `on_disk.unreviewed` audit event. Only a human actor may (409 otherwise).',
  hud: '/exodus/jobs/[id]/directories/[itemId]',
} satisfies Operation;

export const unreviewOnDisk = handle(
  'DELETE /queue-items/:id/on-disk-review',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    await discoveryService.unreviewOnDisk(id, actorOf(res));
    res.status(204).end();
  },
);

// Does: list a source's on-disk reviews.
// Who: the local-sync script (REST). Not used by the UI.
export const listOnDiskReviewsOperation = {
  summary: 'List on-disk reviews',
  description:
    'A source’s acknowledged directories, ordered by path. Filter with `pathPrefix` (default limit 500, max 1000).',
  hud: '/exodus/jobs/[id]/directories/[itemId]',
} satisfies Operation;

export const listOnDiskReviews = handle(
  'GET /sources/:id/on-disk-reviews',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    const filters = req.query as unknown as OnDiskReviewListQuery;
    res
      .status(200)
      .json(await discoveryService.listSourceOnDiskReviews(id, filters));
  },
);
