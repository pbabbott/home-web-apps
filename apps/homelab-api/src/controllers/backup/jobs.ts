import * as backupService from '../../services/backup';
import { actorOf } from '../../lib/actor';
import { handle } from './handle';
import type { Operation } from '../operation';
import type {
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
