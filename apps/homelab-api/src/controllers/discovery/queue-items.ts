import * as discoveryService from '../../services/discovery';
import { handle } from './handle';
import type {
  ClaimQueueItemBody,
  CompleteQueueItemBody,
  EnqueueQueueItemsBody,
  FailQueueItemBody,
  HeartbeatQueueItemBody,
  JobIdParams,
  JobQueueItemListQuery,
  QueueItemIdParams,
  QueueItemListQuery,
  SkipQueueItemBody,
  SourceIdParams,
} from '../../schemas/discovery';

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

export const listJobQueueItems = handle(
  'GET /discovery-jobs/:id/queue-items',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    const filters = req.query as JobQueueItemListQuery;
    res.status(200).json(await discoveryService.listJobQueueItems(id, filters));
  },
);

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

export const completeQueueItem = handle(
  'POST /queue-items/:id/complete',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    const { claimToken, discoveredPaths } = req.body as CompleteQueueItemBody;
    const { item, children } = await discoveryService.completeItem(
      id,
      claimToken,
      discoveredPaths,
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

export const retryQueueItem = handle(
  'POST /queue-items/:id/retry',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    res.status(200).json(await discoveryService.retryItem(id));
  },
);
