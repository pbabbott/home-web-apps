import * as backupService from '../../services/backup';
import { actorOf } from '../../lib/actor';
import { handle } from './handle';
import type { Operation } from '../operation';
import type { IdParams } from '../../schemas/backup/common';
import type {
  CreateBackupDestinationBody,
  UpdateBackupDestinationBody,
} from '../../schemas/backup/destinations';

// Does: register an NFS export as a backup destination.
// Who: human (home-hud). No MCP tool: backup is human-only.
export const createBackupDestinationOperation = {
  summary: 'Create a backup destination',
  description:
    'Registers the expected identity of an NFS export (`server`, `exportPath`) and an optional `rootDir` under it. Where the export is mounted comes from the worker’s environment, so the API never touches the NAS: call `validate` and the worker checks the mount. Records an audit event.',
  hud: '/exodus/backup',
} satisfies Operation;

export const createBackupDestination = handle(
  'POST /backup-destinations',
  async (req, res) => {
    const body = req.body as CreateBackupDestinationBody;
    res
      .status(201)
      .json(await backupService.createDestination(body, actorOf(res)));
  },
);

// Does: list destinations with health and worker liveness.
// Who: human (home-hud). No MCP tool.
export const listBackupDestinationsOperation = {
  summary: 'List backup destinations',
  description:
    '`workerStale` is true when no worker has polled recently, so a validation request would not be picked up.',
  hud: '/exodus/backup',
} satisfies Operation;

export const listBackupDestinations = handle(
  'GET /backup-destinations',
  async (_req, res) => {
    res.status(200).json(await backupService.listDestinations());
  },
);

// Does: fetch one destination.
// Who: human (home-hud). No MCP tool.
export const getBackupDestinationOperation = {
  summary: 'Fetch a backup destination',
  hud: '/exodus/backup',
} satisfies Operation;

export const getBackupDestination = handle(
  'GET /backup-destinations/:id',
  async (req, res) => {
    const { id } = req.params as IdParams;
    res.status(200).json(await backupService.getDestination(id));
  },
);

// Does: rename a destination or change where its data lives.
// Who: human (home-hud). No MCP tool.
export const updateBackupDestinationOperation = {
  summary: 'Update a backup destination',
  description:
    '`hostId`, `settings` and `rootDir` say where the data lives, so they cannot change while the destination has an active job or any verified job item (409): moving the data means a new destination. A rename is always allowed. Records an audit event.',
  hud: '/exodus/backup',
} satisfies Operation;

export const updateBackupDestination = handle(
  'PATCH /backup-destinations/:id',
  async (req, res) => {
    const { id } = req.params as IdParams;
    const body = req.body as UpdateBackupDestinationBody;
    res
      .status(200)
      .json(await backupService.updateDestination(id, body, actorOf(res)));
  },
);

// Does: ask the worker to validate the mount.
// Who: human (home-hud). No MCP tool.
export const validateBackupDestinationOperation = {
  summary: 'Request validation of a backup destination',
  description:
    'Sets `validationRequestedAt` and answers 202. The worker owns the mount: it runs the checks, clears the request and writes `lastValidation`, `health` and `lastValidatedAt`. Poll the destination to see the result. Nothing happens while `workerStale` is true.',
  hud: '/exodus/backup',
} satisfies Operation;

export const validateBackupDestination = handle(
  'POST /backup-destinations/:id/validate',
  async (req, res) => {
    const { id } = req.params as IdParams;
    res.status(202).json(await backupService.requestValidation(id));
  },
);

// Does: enable a destination so it takes jobs and hands out claims.
// Who: human (home-hud). No MCP tool.
export const enableBackupDestinationOperation = {
  summary: 'Enable a backup destination',
  description: 'Idempotent. Records an audit event only when it changes.',
  hud: '/exodus/backup',
} satisfies Operation;

export const enableBackupDestination = handle(
  'POST /backup-destinations/:id/enable',
  async (req, res) => {
    const { id } = req.params as IdParams;
    res
      .status(200)
      .json(await backupService.setDestinationEnabled(id, true, actorOf(res)));
  },
);

// Does: disable a destination: no new jobs, claims answer destination_disabled.
// Who: human (home-hud). No MCP tool.
export const disableBackupDestinationOperation = {
  summary: 'Disable a backup destination',
  description:
    'New jobs are refused (409) and claims for its running jobs hand out nothing and spend no attempts. Idempotent.',
  hud: '/exodus/backup',
} satisfies Operation;

export const disableBackupDestination = handle(
  'POST /backup-destinations/:id/disable',
  async (req, res) => {
    const { id } = req.params as IdParams;
    res
      .status(200)
      .json(await backupService.setDestinationEnabled(id, false, actorOf(res)));
  },
);
