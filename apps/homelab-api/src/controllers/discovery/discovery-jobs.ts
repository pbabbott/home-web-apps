import * as discoveryService from '../../services/discovery';
import { handle } from './handle';
import type {
  CreateDiscoveryJobBody,
  FailDiscoveryJobBody,
  JobIdParams,
  JobListQuery,
  SourceIdParams,
} from '../../schemas/discovery';

export const createDiscoveryJob = handle(
  'POST /sources/:id/discovery-jobs',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    const { rootPath } = req.body as CreateDiscoveryJobBody;
    res
      .status(201)
      .json(await discoveryService.createDiscoveryJob(id, rootPath));
  },
);

export const listSourceJobs = handle(
  'GET /sources/:id/discovery-jobs',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    res.status(200).json(await discoveryService.listSourceJobs(id));
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
