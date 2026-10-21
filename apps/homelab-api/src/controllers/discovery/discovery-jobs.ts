import * as discoveryService from '../../services/discovery';
import { handle } from './handle';
import type { Operation } from '../operation';
import type {
  CreateDiscoveryJobBody,
  FailDiscoveryJobBody,
  JobIdParams,
  JobListQuery,
  SourceIdParams,
} from '../../schemas/discovery';

// Does: start a pending job for a source, queueing rootPath as its first
// directory.
// Who: human (home-hud). No MCP tool: job lifecycle is human-only.
export const createDiscoveryJobOperation = {
  summary: 'Start a discovery job for a source',
  description:
    'Creates a pending job, queues rootPath as its first directory. A source can have only one pending/running job at a time. The job moves to running when its first item is claimed.',
  hud: '/exodus/sources/[id]',
} satisfies Operation;

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

// Does: list one source's jobs, newest first (no queueCounts).
// Who: human (home-hud source detail page). No MCP tool.
export const listSourceJobsOperation = {
  summary: 'List a source’s discovery jobs, newest first',
  description:
    'At most 50. queueCounts is omitted here — fetch it per job via GET /discovery-jobs/{id}.',
  hud: '/exodus/sources/[id]',
} satisfies Operation;

export const listSourceJobs = handle(
  'GET /sources/:id/discovery-jobs',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    res.status(200).json(await discoveryService.listSourceJobs(id));
  },
);

// Does: list jobs across all sources, newest first, with source name and host.
// Who: human (home-hud jobs page) and agent (list_discovery_jobs), to find
// active jobs to resume.
export const listDiscoveryJobsOperation = {
  summary: 'List discovery jobs across all sources, newest first',
  description:
    'At most 100, each with its source’s name and host. Filter with sourceId to see only one source’s jobs. queueCounts is omitted — fetch it via GET /discovery-jobs/{id}.',
  mcp: {
    name: 'list_discovery_jobs',
    description:
      'List discovery jobs with their source. Use to find active (pending/running) jobs to resume.',
  },
  hud: '/exodus/jobs',
} satisfies Operation;

export const listDiscoveryJobs = handle(
  'GET /discovery-jobs',
  async (req, res) => {
    const { sourceId } = req.query as JobListQuery;
    res.status(200).json(await discoveryService.listAllJobs(sourceId));
  },
);

// Does: fetch one job with its queueCounts.
// Who: human (home-hud) and agent (get_discovery_job), to check progress.
export const getDiscoveryJobOperation = {
  summary: 'Fetch a discovery job with its queue counts',
  mcp: {
    name: 'get_discovery_job',
    description:
      'Get one discovery job, including queueCounts, to check status and progress.',
  },
  hud: '/exodus/sources/[id]',
} satisfies Operation;

export const getDiscoveryJob = handle(
  'GET /discovery-jobs/:id',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    res.status(200).json(await discoveryService.getDiscoveryJob(id));
  },
);

// Does: mark a job completed once no item is queued or in progress.
// Who: human (home-hud). No MCP tool: an agent seeing queue_empty from
// claim_directory leaves completion to a human.
export const completeDiscoveryJobOperation = {
  summary: 'Mark a job completed',
  description:
    'Allowed once no item is queued or in progress (expired leases are reclaimed first; an item waiting out a retry backoff still counts as queued). Permanently failed items do not block completion — they are reported in queueCounts.failed. 409 returns the blocking queueCounts.',
  hud: '/exodus/sources/[id]',
} satisfies Operation;

export const completeDiscoveryJob = handle(
  'POST /discovery-jobs/:id/complete',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    res.status(200).json(await discoveryService.completeJob(id));
  },
);

// Does: cancel a pending or running job, releasing in-progress leases.
// Who: human (home-hud). No MCP tool.
export const cancelDiscoveryJobOperation = {
  summary: 'Cancel a pending or running job',
  description:
    'In-progress items are released back to queued with no claim, so a worker still holding one is rejected (409) on its next call. Queued items stay on record as unexplored work. Terminal jobs reject all further item changes.',
  hud: '/exodus/sources/[id]',
} satisfies Operation;

export const cancelDiscoveryJob = handle(
  'POST /discovery-jobs/:id/cancel',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    res.status(200).json(await discoveryService.cancelJob(id));
  },
);

// Does: mark a pending or running job failed, releasing in-progress leases.
// Who: human (home-hud source detail page, Mark Failed). No MCP tool.
export const failDiscoveryJobOperation = {
  summary: 'Mark a pending or running job failed',
  description:
    'Releases leases the same way as cancel: in-progress items return to queued with no claim and a worker still holding one gets 409.',
  hud: '/exodus/sources/[id]',
} satisfies Operation;

export const failDiscoveryJob = handle(
  'POST /discovery-jobs/:id/fail',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    const { error } = req.body as FailDiscoveryJobBody;
    res.status(200).json(await discoveryService.failJob(id, error));
  },
);
