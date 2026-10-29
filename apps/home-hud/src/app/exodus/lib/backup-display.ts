import type { BadgeColor } from '@abbottland/fui-components';
import type {
  BackupCoverageBucket,
  BackupDestination,
  BackupEntryStatus,
  BackupJob,
  BackupJobItem,
  BackupJobItemStatus,
  BackupJobProgress,
  BackupJobStatus,
  BackupPlanWarning,
  BackupStalledReason,
} from '../sources/lib/homelab-api';
import { formatSize } from './inventory-display';

export const BACKUP_JOB_STATUS_COLOR: Record<BackupJobStatus, BadgeColor> = {
  planned: 'warning',
  running: 'secondary',
  completed: 'success',
  completed_with_issues: 'warning',
  failed: 'error',
  cancelled: 'dark',
};

export const BACKUP_ITEM_STATUS_COLOR: Record<BackupJobItemStatus, BadgeColor> =
  {
    queued: 'warning',
    in_progress: 'secondary',
    verified: 'success',
    failed: 'error',
    blocked: 'error',
    skipped: 'dark',
    excluded: 'dark',
  };

export const BACKUP_ENTRY_STATUS_COLOR: Record<BackupEntryStatus, BadgeColor> =
  {
    pending: 'warning',
    verified: 'success',
    failed: 'error',
    not_followed: 'dark',
  };

const ACTIVE_JOB_STATUSES: BackupJobStatus[] = ['planned', 'running'];

export const isActiveBackupJob = (job: { status: BackupJobStatus }): boolean =>
  ACTIVE_JOB_STATUSES.includes(job.status);

/** Plain words for a paused job; the worker resumes it by itself. */
export const STALLED_REASON_TEXT: Record<BackupStalledReason, string> = {
  source_unreachable:
    'The source machine is not answering (switched off, or its file sharing is failing). The job is paused and no attempts are being spent. It resumes by itself when the machine answers again.',
  destination_unhealthy:
    'The NAS destination failed a check or stopped responding. The job is paused and no attempts are being spent. It resumes once the destination validates again; the worker re-checks it by itself.',
  destination_disabled:
    'The destination is disabled, so nothing is copied. Enable it to continue.',
};

/** Short form for tables. */
export const STALLED_REASON_LABEL: Record<BackupStalledReason, string> = {
  source_unreachable: 'source not answering',
  destination_unhealthy: 'destination unhealthy',
  destination_disabled: 'destination disabled',
};

export const stalledReasonText = (reason: BackupStalledReason): string =>
  STALLED_REASON_TEXT[reason];

export type DestinationStatus = {
  label: string;
  color: BadgeColor;
  /** Names of the validation checks that failed, with their messages. */
  failedChecks: string[];
  noWorker: boolean;
  validationPending: boolean;
};

/** One-glance state of a destination: what its health says, and whether anyone is there to change it. */
export function destinationStatus(
  destination: BackupDestination,
): DestinationStatus {
  const failedChecks = (destination.lastValidation?.checks ?? [])
    .filter((check) => !check.ok)
    .map((check) =>
      check.message ? `${check.name}: ${check.message}` : check.name,
    );

  let label = 'Not validated yet';
  let color: BadgeColor = 'dark';

  if (!destination.enabled) {
    label = 'Disabled';
  } else if (destination.health === 'ok') {
    label = 'Healthy';
    color = 'success';
  } else if (destination.health === 'unhealthy') {
    label = 'Unhealthy';
    color = 'error';
  }

  return {
    label,
    color,
    failedChecks,
    noWorker: destination.workerStale,
    validationPending: destination.validationRequestedAt !== null,
  };
}

const done = (counts: BackupJobProgress['itemCounts']): number =>
  counts.verified + counts.skipped + counts.excluded;

export type BackupProgressSummary = {
  /** Items finished (verified, skipped or excluded) of all items. */
  itemsDone: number;
  itemsTotal: number;
  /** Fraction of items finished, 0..1; 1 for an empty job. */
  itemFraction: number;
  files: string;
  bytes: string;
  /** Some items had no size estimate, so the total is a floor. */
  estimateIsFloor: boolean;
};

/** Progress for the job page, from the counts the API derives. */
export function backupProgress(
  progress: BackupJobProgress,
): BackupProgressSummary {
  const itemsTotal = Object.values(progress.itemCounts).reduce(
    (sum, n) => sum + n,
    0,
  );
  const itemsDone = done(progress.itemCounts);
  const entries = progress.entryCounts;
  const entriesTotal =
    entries.pending + entries.verified + entries.failed + entries.not_followed;
  const estimate =
    progress.estimatedBytes > 0
      ? ` of about ${formatSize(progress.estimatedBytes)}${progress.unestimatedItems > 0 ? ' or more' : ''}`
      : '';

  return {
    itemsDone,
    itemsTotal,
    itemFraction: itemsTotal === 0 ? 1 : itemsDone / itemsTotal,
    files: `${entries.verified} of ${entriesTotal} files and folders verified`,
    bytes: `${formatSize(progress.verifiedBytes)} copied${estimate}`,
    estimateIsFloor: progress.unestimatedItems > 0,
  };
}

const unresolved = (job: Pick<BackupJob, 'progress'>): number =>
  job.progress.itemCounts.failed + job.progress.itemCounts.blocked;

export const canCancelBackupJob = (job: Pick<BackupJob, 'status'>): boolean =>
  isActiveBackupJob(job);

/** A retry grants one more attempt, only while the job is still active. */
export const canRetryBackupItem = (
  job: Pick<BackupJob, 'status'>,
  item: Pick<BackupJobItem, 'status'>,
): boolean =>
  isActiveBackupJob(job) &&
  (item.status === 'failed' || item.status === 'blocked');

export const canRetryFailedBackupItems = (
  job: Pick<BackupJob, 'status' | 'progress'>,
): boolean => isActiveBackupJob(job) && unresolved(job) > 0;

/** A finished job's failures are retried by planning a new job. */
export const canRerunBackupJob = (
  job: Pick<BackupJob, 'status' | 'progress'>,
): boolean => !isActiveBackupJob(job) && unresolved(job) > 0;

export const PLAN_WARNING_TEXT: Record<BackupPlanWarning['code'], string> = {
  discovery_job_active:
    'A discovery job is running for this source. Inventory may still change; anything approved later is not part of this job.',
  destination_folder_exists:
    'This source’s folder already exists on the destination. Identical files are adopted; different ones are kept next to the existing file, never overwritten.',
  destination_folder_unknown:
    'The destination has not been validated, so it is not known whether this source’s folder already exists.',
};

export const planWarningText = (warning: BackupPlanWarning): string =>
  PLAN_WARNING_TEXT[warning.code] ?? warning.message;

export const COVERAGE_BUCKET_LABEL: Record<BackupCoverageBucket, string> = {
  covered: 'Covered',
  redundant_covered: 'Covered inside a folder',
  excluded_rule: 'Excluded by rule',
  rejected: 'Rejected',
  undecided: 'Undecided',
  pending: 'In progress',
  failed: 'Failed',
  blocked: 'Blocked',
  never_attempted: 'Never attempted',
};

/** Order the buckets are shown in: problems first. */
export const COVERAGE_BUCKETS: BackupCoverageBucket[] = [
  'never_attempted',
  'undecided',
  'pending',
  'failed',
  'blocked',
  'covered',
  'redundant_covered',
  'excluded_rule',
  'rejected',
];

/** Buckets that stop "all accounted for". */
const BLOCKING: ReadonlySet<BackupCoverageBucket> = new Set([
  'undecided',
  'pending',
  'failed',
  'blocked',
  'never_attempted',
]);

export const isBlockingBucket = (bucket: BackupCoverageBucket): boolean =>
  BLOCKING.has(bucket);

export const COVERAGE_BUCKET_COLOR: Record<BackupCoverageBucket, BadgeColor> = {
  covered: 'success',
  redundant_covered: 'success',
  excluded_rule: 'dark',
  rejected: 'dark',
  undecided: 'warning',
  pending: 'secondary',
  failed: 'error',
  blocked: 'error',
  never_attempted: 'warning',
};

export const parseCoverageBucket = (
  value: string | undefined,
): BackupCoverageBucket | undefined =>
  COVERAGE_BUCKETS.find((bucket) => bucket === value);

export const parseBackupItemStatus = (
  value: string | undefined,
): BackupJobItemStatus | undefined =>
  (Object.keys(BACKUP_ITEM_STATUS_COLOR) as BackupJobItemStatus[]).find(
    (status) => status === value,
  );

export const backupOverviewUrl = (
  sourceId?: string,
  destinationId?: string,
) => {
  const query = new URLSearchParams();

  if (sourceId) query.set('source', sourceId);
  if (destinationId) query.set('destination', destinationId);

  return query.size > 0 ? `/exodus/backup?${query}` : '/exodus/backup';
};

export const backupJobUrl = (jobId: string, status?: BackupJobItemStatus) =>
  status
    ? `/exodus/backup/${jobId}?status=${status}`
    : `/exodus/backup/${jobId}`;

export const backupCoverageUrl = (
  sourceId: string,
  destinationId: string,
  bucket?: BackupCoverageBucket,
) => {
  const query = new URLSearchParams({
    source: sourceId,
    destination: destinationId,
  });

  if (bucket) query.set('bucket', bucket);

  return `/exodus/backup/coverage?${query}`;
};

/** Same-origin download of the full JSON report (the browser never talks to homelab-api). */
export const coverageDownloadUrl = (
  sourceId: string,
  destinationId: string,
): string =>
  `/exodus/backup/coverage/download?${new URLSearchParams({ sourceId, destinationId })}`;
