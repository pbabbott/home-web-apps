import * as discoveryService from '../../services/discovery';
import { handle } from './handle';
import type { Operation } from '../operation';
import type {
  ClaimQueueItemBody,
  CompleteQueueItemBody,
  EnqueueQueueItemsBody,
  FailQueueItemBody,
  HeartbeatQueueItemBody,
  JobIdParams,
  JobQueueItemListQuery,
  KnownSkipListQuery,
  QueueItemIdParams,
  QueueItemListQuery,
  SkipQueueItemBody,
  SourceIdParams,
} from '../../schemas/discovery';

// Does: list queue items across all of a source's jobs, with filters.
// Who: human (home-hud source detail page). No MCP tool.
export const listSourceQueueItemsOperation = {
  summary: 'List a source’s queue items',
  description:
    'Newest 500 at most, oldest first. Filter by status=failed to inspect permanent failures.',
  hud: '/exodus/sources/[id]',
} satisfies Operation;

export const listSourceQueueItems = handle(
  'GET /sources/:id/queue-items',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    const filters = req.query as QueueItemListQuery;
    res
      .status(200)
      .json(await discoveryService.listSourceQueueItems(id, filters));
  },
);

// Does: list queue items for one job, with a status filter.
// Who: human (home-hud job detail page). Agents read queueCounts via
// get_discovery_job.
export const listJobQueueItemsOperation = {
  summary: 'List a job’s queue items',
  description: 'At most 500, oldest first. Filter with status.',
  hud: '/exodus/jobs/[id]',
} satisfies Operation;

export const listJobQueueItems = handle(
  'GET /discovery-jobs/:id/queue-items',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    const filters = req.query as JobQueueItemListQuery;
    res.status(200).json(await discoveryService.listJobQueueItems(id, filters));
  },
);

// Does: enqueue directory paths for a job; idempotent per path (`created` flag).
// Who: human (home-hud job detail page), to add work to a running job. No MCP tool: agents add work through
// complete_directory's discoveredPaths.
export const enqueueQueueItemsOperation = {
  summary: 'Enqueue directories for a job',
  description:
    'Paths are normalized (slashes, case, trailing separators) and deduplicated per job; already-queued paths are returned with created=false. Every path must be inside the job’s root.',
  hud: '/exodus/jobs/[id]',
} satisfies Operation;

export const enqueueQueueItems = handle(
  'POST /discovery-jobs/:id/queue-items',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    const { paths, priority } = req.body as EnqueueQueueItemsBody;
    const results = await discoveryService.enqueuePaths(id, paths, priority);
    res
      .status(200)
      .json(results.map(({ item, created }) => ({ ...item, created })));
  },
);

// Does: lease the next eligible directory to a worker; returns a claimToken.
// Who: agent (claim_directory).
export const claimQueueItemOperation = {
  summary: 'Claim the next directory to inspect',
  description:
    'Atomically leases the highest-priority eligible item (concurrent callers never get the same one) and starts the job if it was pending. Items whose lease expired are reclaimed first. Keep the item’s claimToken: every later call on the item needs it. Always 200: when nothing is claimable, item is null and reason says whether to stop (queue_empty), wait for a retry delay (retry_backoff), or wait for other workers (in_progress), with retryAt telling when to ask again.',
  mcp: {
    name: 'claim_directory',
    description:
      'Lease the next directory of a job. Returns { id, path, reason, claimToken } (claimToken is required by every later call on it), or { idle, next } where next is `stop` (queue empty) or `wait` (retry at retryAt).',
  },
} satisfies Operation;

export const claimQueueItem = handle(
  'POST /discovery-jobs/:id/queue-items/claim',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    const { workerId, leaseSeconds } = req.body as ClaimQueueItemBody;
    res
      .status(200)
      .json(await discoveryService.claimQueueItem(id, workerId, leaseSeconds));
  },
);

// Does: extend the lease on a claimed directory.
// Who: agent (heartbeat_directory), during long-running exploration.
export const heartbeatQueueItemOperation = {
  summary: 'Extend a claim’s lease',
  mcp: {
    name: 'heartbeat_directory',
    description:
      'Extend the lease on a claimed directory (default 5 minutes) so a long exploration is not reclaimed.',
  },
} satisfies Operation;

export const heartbeatQueueItem = handle(
  'POST /queue-items/:id/heartbeat',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    const { claimToken, leaseSeconds } = req.body as HeartbeatQueueItemBody;
    res
      .status(200)
      .json(await discoveryService.heartbeat(id, claimToken, leaseSeconds));
  },
);

// Does: mark a claimed directory done and enqueue its child directories
// (`discoveredPaths`) in one transaction.
// Who: agent (complete_directory). This is what drives the tree walk.
export const completeQueueItemOperation = {
  summary: 'Complete a claimed directory and enqueue the follow-ups it needs',
  description:
    'The completion and the discoveredPaths enqueue happen in one transaction, so follow-up work is never lost to a crash in between. Queue only paths that warrant more inspection (with a reason), not every child. `summary`, `skipped` and `skippedGroups` are stored on the item as its result. Follow-ups under an exclusion rule are skipped immediately.',
  mcp: {
    name: 'complete_directory',
    description:
      'Finish a claimed directory. discoveredPaths: subdirectories to explore later; skipped / skippedGroups: entries deliberately not explored; summary: one line. Returns what was queued, and what was auto-excluded by a rule.',
  },
} satisfies Operation;

export const completeQueueItem = handle(
  'POST /queue-items/:id/complete',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    const { claimToken, discoveredPaths, summary, skipped, skippedGroups } =
      req.body as CompleteQueueItemBody;
    const { item, children } = await discoveryService.completeItem(
      id,
      claimToken,
      discoveredPaths,
      { summary, skipped, skippedGroups },
    );
    res.status(200).json({
      ...item,
      children: children.map((child) => ({
        ...child.item,
        created: child.created,
      })),
    });
  },
);

// Does: record an error on a claimed directory; `retryable` picks requeue with
// backoff or permanent failure.
// Who: agent (fail_directory).
export const failQueueItemOperation = {
  summary: 'Record a failure for a claimed directory',
  description:
    'A retryable failure with attempts left returns the item to queued behind an exponential backoff (30s, 60s, … capped at 1h). Otherwise it becomes failed and stays visible until a human retries it. lastError is always recorded.',
  mcp: {
    name: 'fail_directory',
    description:
      'Report that a claimed directory could not be explored. Retryable failures are requeued with backoff until attempts run out; retryable=false fails it permanently.',
  },
} satisfies Operation;

export const failQueueItem = handle(
  'POST /queue-items/:id/fail',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    const { claimToken, error, retryable } = req.body as FailQueueItemBody;
    res
      .status(200)
      .json(await discoveryService.failItem(id, claimToken, error, retryable));
  },
);

// Does: mark a claimed directory intentionally skipped, with a reason.
// Who: agent (skip_directory), e.g. for system directories.
export const skipQueueItemOperation = {
  summary: 'Skip a claimed directory',
  mcp: {
    name: 'skip_directory',
    description: 'Mark the whole claimed directory as skipped, with a reason.',
  },
} satisfies Operation;

export const skipQueueItem = handle(
  'POST /queue-items/:id/skip',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    const { claimToken, reason } = req.body as SkipQueueItemBody;
    res
      .status(200)
      .json(await discoveryService.skipItem(id, claimToken, reason));
  },
);

// Does: requeue a permanently failed directory for one more attempt. No
// claimToken: it acts on a failed item nobody holds a lease on.
// Who: human only (home-hud retry button). Deliberately not an MCP tool.
export const retryQueueItemOperation = {
  summary: 'Retry a failed item',
  description:
    'Requeues a failed item for exactly one more attempt; attemptCount and lastError are kept. Only allowed while the item’s job is pending or running; a finished job’s failures are retried by starting a new job.',
  hud: '/exodus/sources/[id]',
} satisfies Operation;

export const retryQueueItem = handle(
  'POST /queue-items/:id/retry',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    res.status(200).json(await discoveryService.retryItem(id));
  },
);

// Does: list paths earlier jobs of a source chose not to explore.
// Who: agent (list_known_skips) and human (REST).
export const listKnownSkipsOperation = {
  summary: 'List paths earlier jobs chose not to explore',
  description:
    'Derived from the `skipped` lists stored on the source’s queue items, newest reason per path (case-insensitive), ordered by path. These are per-run judgments, not exclusion rules: a later run may revisit one, and nothing here blocks exploring or proposing a path. Filter with `pathPrefix` (default limit 200, max 1000).',
  mcp: {
    name: 'list_known_skips',
    description:
      'Paths earlier runs of this source deliberately did not explore, with reason and date. A `pattern` entry covers the matching direct children of its `path`.',
  },
} satisfies Operation;

export const listKnownSkips = handle(
  'GET /sources/:id/known-skips',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    const filters = req.query as unknown as KnownSkipListQuery;
    res
      .status(200)
      .json(await discoveryService.listSourceKnownSkips(id, filters));
  },
);
