import { Request, RequestHandler, Response } from 'express';
import * as discoveryService from '../services/discovery';
import type {
  ClaimQueueItemBody,
  CompleteQueueItemBody,
  CreateBackupSourceBody,
  CreateDiscoveryJobBody,
  EnqueueQueueItemsBody,
  FailDiscoveryJobBody,
  FailQueueItemBody,
  HeartbeatQueueItemBody,
  JobIdParams,
  JobListQuery,
  QueueItemIdParams,
  QueueItemListQuery,
  SkipQueueItemBody,
  SourceIdParams,
} from '../schemas/discovery';

/**
 * Wraps a handler so a DiscoveryError becomes 404/409 (with any structured
 * details, e.g. queueCounts, merged into the body) and anything else is
 * logged and returned as a generic 500, like the hand-written try/catch in
 * the other controllers.
 */
const handle =
  (
    label: string,
    fn: (req: Request, res: Response) => Promise<void>,
  ): RequestHandler =>
  async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof discoveryService.DiscoveryError) {
        res
          .status(err.code === 'not_found' ? 404 : 409)
          .json({ message: err.message, ...err.details });
        return;
      }

      console.error(`${label} failed:`, err);
      res.status(500).json({ message: 'internal server error' });
    }
  };

export const createBackupSource = handle(
  'POST /backup-sources',
  async (req, res) => {
    const body = req.body as CreateBackupSourceBody;
    res.status(201).json(await discoveryService.createBackupSource(body));
  },
);

export const listBackupSources = handle(
  'GET /backup-sources',
  async (_req, res) => {
    res.status(200).json(await discoveryService.listBackupSources());
  },
);

export const createDiscoveryJob = handle(
  'POST /backup-sources/:id/discovery-jobs',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    const { rootPath } = req.body as CreateDiscoveryJobBody;
    res
      .status(201)
      .json(await discoveryService.createDiscoveryJob(id, rootPath));
  },
);

export const listSourceJobs = handle(
  'GET /backup-sources/:id/discovery-jobs',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    res.status(200).json(await discoveryService.listSourceJobs(id));
  },
);

export const listSourceQueueItems = handle(
  'GET /backup-sources/:id/queue-items',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    const filters = req.query as QueueItemListQuery;
    res
      .status(200)
      .json(await discoveryService.listSourceQueueItems(id, filters));
  },
);

export const listDiscoveryJobs = handle(
  'GET /discovery-jobs',
  async (req, res) => {
    const { sourceId } = req.query as JobListQuery;
    res.status(200).json(await discoveryService.listAllJobs(sourceId));
  },
);

export const getDiscoveryJob = handle(
  'GET /discovery-jobs/:id',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    res.status(200).json(await discoveryService.getDiscoveryJob(id));
  },
);

export const completeDiscoveryJob = handle(
  'POST /discovery-jobs/:id/complete',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    res.status(200).json(await discoveryService.completeJob(id));
  },
);

export const cancelDiscoveryJob = handle(
  'POST /discovery-jobs/:id/cancel',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    res.status(200).json(await discoveryService.cancelJob(id));
  },
);

export const failDiscoveryJob = handle(
  'POST /discovery-jobs/:id/fail',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    const { error } = req.body as FailDiscoveryJobBody;
    res.status(200).json(await discoveryService.failJob(id, error));
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
    const item = await discoveryService.claimQueueItem(
      id,
      workerId,
      leaseSeconds,
    );

    if (!item) {
      res.status(204).send();
      return;
    }
    res.status(200).json(item);
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
