import * as backupService from '../../services/backup';
import { actorOf } from '../../lib/actor';
import { handle } from './handle';
import type { Operation } from '../operation';
import type {
  BackupJobListQuery,
  FailBackupJobBody,
  JobIdParams,
  PlanBackupJobBody,
  SourceIdParams,
} from '../../schemas/backup/jobs';

// Does: dry-run a backup job: what would be copied, skipped, excluded or left out.
// Who: human (home-hud "Start backup job" button). No MCP tool: backup is human-only.
export const planBackupJobOperation = {
  summary: 'Plan a backup job (dry run)',
  description:
    'Applies the planning rules to the source’s inventory and writes nothing. Approved items under an `exclude_subtree` rule are `excluded`; approved items inside another approved directory the job copies are `skipped` (`redundant_nested`); with `skipAlreadyCovered` (default) items already verified at the destination are `skipped` (`already_covered`); the rest are `queued`. Items that are not approved are listed in `notEligible` and are not part of the job. The summary gives the estimated size and how many items have no estimate, and `warnings` flags an active discovery job and an existing source folder at the destination. 409: unknown or disabled destination, an active job for this source and destination, a source folder name taken by another source, or nothing to back up.',
  hud: '/exodus/backup',
} satisfies Operation;

export const planBackupJob = handle(
  'POST /sources/:id/backup-jobs/plan',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    const body = req.body as PlanBackupJobBody;
    res.status(200).json(await backupService.planJob(id, body));
  },
);

// Does: create a planned backup job with a frozen scope.
// Who: human (home-hud). No MCP tool.
export const createBackupJobOperation = {
  summary: 'Create a backup job',
  description:
    'Runs the same planning as `plan` and inserts the job and all its items in one transaction. The scope is frozen: newly approved inventory needs a new job. The job is ready to run: the destination’s worker claims its first item, which moves it from `planned` to `running`. There is no separate start. Records an audit event.',
  hud: '/exodus/backup',
} satisfies Operation;

export const createBackupJob = handle(
  'POST /sources/:id/backup-jobs',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    const body = req.body as PlanBackupJobBody;
    res.status(201).json(await backupService.createJob(id, body, actorOf(res)));
  },
);

// Does: list jobs across sources, newest first, with derived progress.
// Who: human (home-hud). No MCP tool.
export const listBackupJobsOperation = {
  summary: 'List backup jobs, newest first',
  description:
    'At most 200 (default 50). `progress` holds the counts derived from the job’s items and entries.',
  hud: '/exodus/backup',
} satisfies Operation;

export const listBackupJobs = handle('GET /backup-jobs', async (req, res) => {
  const query = req.query as unknown as BackupJobListQuery;
  res.status(200).json(await backupService.listJobs(query));
});

// Does: fetch one job with progress and stalledReason.
// Who: human (home-hud job page). No MCP tool.
export const getBackupJobOperation = {
  summary: 'Fetch a backup job with its progress',
  description:
    '`stalledReason` is set while the worker has paused claims (the job stays `running`): the destination is unhealthy or disabled, or the source is unreachable. No attempts are spent while stalled. A completed job never implies full coverage: see the coverage report.',
  hud: '/exodus/backup/[jobId]',
} satisfies Operation;

export const getBackupJob = handle('GET /backup-jobs/:id', async (req, res) => {
  const { id } = req.params as JobIdParams;
  res.status(200).json(await backupService.getJob(id));
});

// Does: cancel a planned or running job, releasing leases.
// Who: human (home-hud). No MCP tool.
export const cancelBackupJobOperation = {
  summary: 'Cancel a planned or running backup job',
  description:
    'In-progress items return to `queued` with no claim, so a worker still holding one is rejected on its next call. Queued items stay queued as the record of what was never done. Verified data is kept. 409 when the job is already finished.',
  hud: '/exodus/backup/[jobId]',
} satisfies Operation;

export const cancelBackupJob = handle(
  'POST /backup-jobs/:id/cancel',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    res.status(200).json(await backupService.cancelJob(id, actorOf(res)));
  },
);

// Does: mark a planned or running job failed, with a reason.
// Who: human (home-hud). No MCP tool.
export const failBackupJobOperation = {
  summary: 'Mark a planned or running backup job failed',
  description:
    'For a run that is broken rather than merely stopped. Releases leases like cancel. 409 when the job is already finished.',
  hud: '/exodus/backup/[jobId]',
} satisfies Operation;

export const failBackupJob = handle(
  'POST /backup-jobs/:id/fail',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    const { error } = req.body as FailBackupJobBody;
    res.status(200).json(await backupService.failJob(id, error, actorOf(res)));
  },
);

// Does: give every failed or blocked item of an active job one more attempt.
// Who: human (home-hud). No MCP tool.
export const retryFailedBackupItemsOperation = {
  summary: 'Retry every failed and blocked item of an active job',
  description:
    'Each item gets exactly one more attempt. Only while the job is active (409 otherwise): a finished job needs `rerun-unresolved`. Answers 200 with `retried: 0` when nothing had failed.',
  hud: '/exodus/backup/[jobId]',
} satisfies Operation;

export const retryFailedBackupItems = handle(
  'POST /backup-jobs/:id/retry-failed',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    res
      .status(200)
      .json(await backupService.retryFailedItems(id, actorOf(res)));
  },
);

// Does: create a new job from the failed and blocked items of a finished job.
// Who: human (home-hud). No MCP tool.
export const rerunUnresolvedOperation = {
  summary: 'Rerun the unresolved items of a finished job',
  description:
    'Creates a new job for the items that ended `failed` or `blocked`, through the normal planning: anything verified since is skipped, and current decisions, rules and the destination’s state apply. 409 when the job is still active, had nothing unresolved, or the new job is refused (disabled destination, another active job).',
  hud: '/exodus/backup/[jobId]',
} satisfies Operation;

export const rerunUnresolved = handle(
  'POST /backup-jobs/:id/rerun-unresolved',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    res.status(201).json(await backupService.rerunUnresolved(id, actorOf(res)));
  },
);
