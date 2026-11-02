import * as backupService from '../../services/backup';
import { actorOf } from '../../lib/actor';
import { handle } from './handle';
import type { Operation } from '../operation';
import type { IdParams } from '../../schemas/backup/common';
import type {
  BackupEntryListQuery,
  BackupJobItemListQuery,
  JobIdParams,
} from '../../schemas/backup/jobs';

// Does: list a job’s items with their status and last error, paged.
// Who: human (home-hud job page). No MCP tool.
export const listBackupJobItemsOperation = {
  summary: 'List the items of a backup job',
  description:
    'Ordered by normalized root path; pass `next` as `after` for the next page. A full page may be followed by an empty one. `claimToken` is never returned.',
  hud: '/exodus/backup/[jobId]',
} satisfies Operation;

export const listBackupJobItems = handle(
  'GET /backup-jobs/:id/items',
  async (req, res) => {
    const { id } = req.params as JobIdParams;
    const query = req.query as unknown as BackupJobItemListQuery;
    res.status(200).json(await backupService.listJobItems(id, query));
  },
);

// Does: fetch one job item with the counts of its entries.
// Who: human (home-hud). No MCP tool.
export const getBackupJobItemOperation = {
  summary: 'Fetch a backup job item',
  description:
    'The snapshot taken when the job was created, its state and lease, and `entryCounts` derived from its entries (with the verified bytes).',
  hud: '/exodus/backup/[jobId]',
} satisfies Operation;

export const getBackupJobItem = handle(
  'GET /backup-job-items/:id',
  async (req, res) => {
    const { id } = req.params as IdParams;
    res.status(200).json(await backupService.getJobItem(id));
  },
);

// Does: page the per-file results and recorded source metadata of an item.
// Who: human (home-hud). No MCP tool.
export const listBackupEntriesOperation = {
  summary: 'List the entries (files and directories) of a job item',
  description:
    'Per-file status, issue, hash, destination path and the source metadata captured before the file was read (times, attributes, streams, Zone.Identifier). Ordered by id; pass `next` as `after` for the next page. A full page may be followed by an empty one.',
  hud: '/exodus/backup/[jobId]',
} satisfies Operation;

export const listBackupEntries = handle(
  'GET /backup-job-items/:id/entries',
  async (req, res) => {
    const { id } = req.params as IdParams;
    const query = req.query as unknown as BackupEntryListQuery;
    res.status(200).json(await backupService.listItemEntries(id, query));
  },
);

// Does: give one failed or blocked item one more attempt.
// Who: human (home-hud). No MCP tool.
export const retryBackupJobItemOperation = {
  summary: 'Retry a failed or blocked backup job item',
  description:
    'Grants exactly one more attempt and keeps the attempt count and last error. Only while the job is active (409 otherwise).',
  hud: '/exodus/backup/[jobId]',
} satisfies Operation;

export const retryBackupJobItem = handle(
  'POST /backup-job-items/:id/retry',
  async (req, res) => {
    const { id } = req.params as IdParams;
    res.status(200).json(await backupService.retryItem(id, actorOf(res)));
  },
);
