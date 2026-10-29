import { getJson } from './http';

export type BackupDestinationHealth = 'unknown' | 'ok' | 'unhealthy';

export type BackupJobStatus =
  | 'planned'
  | 'running'
  | 'completed'
  | 'completed_with_issues'
  | 'failed'
  | 'cancelled';

export type BackupStalledReason =
  | 'destination_unhealthy'
  | 'destination_disabled'
  | 'source_unreachable';

export type BackupJobItemStatus =
  | 'queued'
  | 'in_progress'
  | 'verified'
  | 'failed'
  | 'blocked'
  | 'skipped'
  | 'excluded';

export type BackupEntryStatus =
  | 'pending'
  | 'verified'
  | 'failed'
  | 'not_followed';

export type BackupEntryIssueKind =
  | 'read_failed'
  | 'unlistable'
  | 'source_missing'
  | 'name_too_long'
  | 'unsupported_path'
  | 'verify_mismatch'
  | 'write_failed'
  | 'dest_conflict'
  | 'reparse_point_not_followed'
  | 'kept_both';

export type BackupCoverageBucket =
  | 'covered'
  | 'redundant_covered'
  | 'excluded_rule'
  | 'rejected'
  | 'undecided'
  | 'pending'
  | 'failed'
  | 'blocked'
  | 'never_attempted';

export interface BackupDestinationValidation {
  ok: boolean;
  mountVerified?: boolean;
  checks?: { name: string; ok: boolean; message?: string }[];
  findings?: Record<string, unknown>;
  rootEntries?: string[];
}

export interface BackupDestination {
  id: string;
  name: string;
  connectionType: 'nfs';
  hostId: string;
  /** The host that serves the export; its address is the NFS server. */
  host: { id: string; name: string; ipAddress: string };
  settings: { exportPath: string };
  rootDir: string | null;
  enabled: boolean;
  health: BackupDestinationHealth;
  lastValidatedAt: string | null;
  lastValidation: BackupDestinationValidation | null;
  validationRequestedAt: string | null;
  workerSeenAt: string | null;
  /** The worker serving this destination, while its claim is renewed. */
  claimedBy: string | null;
  claimedUntil: string | null;
  /** True when no worker has polled recently (or ever). */
  workerStale: boolean;
}

export type BackupItemCounts = Record<BackupJobItemStatus, number>;
export type BackupEntryCounts = Record<BackupEntryStatus, number>;

/** Counts derived by homelab-api from the job's items and entries. */
export interface BackupJobProgress {
  itemCounts: BackupItemCounts;
  entryCounts: BackupEntryCounts;
  verifiedBytes: number;
  estimatedBytes: number;
  unestimatedItems: number;
  staleClaims: number;
  lastActivityAt: string | null;
}

export interface BackupJob {
  id: string;
  sourceId: string;
  destinationId: string;
  status: BackupJobStatus;
  stalledReason: BackupStalledReason | null;
  stalledSince: string | null;
  sourceDirName: string;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: BackupJobProgress;
}

export interface BackupJobItem {
  id: string;
  jobId: string;
  inventoryItemId: string | null;
  kind: 'file' | 'directory';
  rootPath: string;
  destRelPath: string;
  estimatedSizeBytes: number | null;
  status: BackupJobItemStatus;
  statusReason: string | null;
  attemptCount: number;
  maxAttempts: number;
  availableAt: string;
  lastError: string | null;
  enumerationComplete: boolean;
  completedAt: string | null;
}

export interface BackupEntry {
  id: number;
  relPath: string;
  entryType: 'file' | 'directory';
  status: BackupEntryStatus;
  issueKind: BackupEntryIssueKind | null;
  message: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  destRelPath: string | null;
  srcCreatedAt: string | null;
  srcModifiedAt: string | null;
}

export interface BackupPlanWarning {
  code:
    | 'discovery_job_active'
    | 'destination_folder_exists'
    | 'destination_folder_unknown';
  message: string;
}

export interface BackupPlan {
  sourceDirName: string;
  summary: {
    toCopy: number;
    skippedAlreadyCovered: number;
    skippedRedundantNested: number;
    excluded: number;
    notEligible: number;
    estimatedBytes: number;
    unestimatedItems: number;
  };
  warnings: BackupPlanWarning[];
}

export interface BackupCoverageItem {
  inventoryItemId: string;
  kind: 'file' | 'directory';
  rootPath: string;
  decision: 'pending' | 'approved' | 'rejected';
  bucket: BackupCoverageBucket;
  latestAttempt: {
    jobId: string;
    jobStatus: BackupJobStatus;
    itemStatus: BackupJobItemStatus;
    statusReason: string | null;
    lastError: string | null;
    attemptCount: number;
  } | null;
}

export interface BackupCoverage {
  allAccounted: boolean;
  generatedAt: string;
  total: number;
  counts: Record<BackupCoverageBucket, number>;
  notes: { keptBothFiles: number; notFollowedEntries: number };
  source: { id: string; name: string };
  destination: { id: string; name: string };
  scope: string;
  limits: string[];
  discoveryReview: {
    jobs: { id: string; rootPath: string; truncated: boolean }[];
    directories: {
      reviewed: number;
      notReviewed: number;
      unknown: number;
      notExplored: number;
    };
    truncated: boolean;
  };
  omittedRejected: number;
  items: BackupCoverageItem[];
}

export function getBackupDestinations(): Promise<BackupDestination[]> {
  return getJson('/backup-destinations');
}

/** Newest first. */
export function getBackupJobs(filter: {
  sourceId?: string;
  destinationId?: string;
}): Promise<BackupJob[]> {
  const query = new URLSearchParams();

  if (filter.sourceId) query.set('sourceId', filter.sourceId);
  if (filter.destinationId) query.set('destinationId', filter.destinationId);

  return getJson(`/backup-jobs?${query}`);
}

export function getBackupJob(id: string): Promise<BackupJob> {
  return getJson(`/backup-jobs/${id}`);
}

/** One page of a job's items (path order); `next` is the cursor for the following page. */
export function getBackupJobItems(
  jobId: string,
  status?: BackupJobItemStatus,
): Promise<{ items: BackupJobItem[]; next: string | null }> {
  const query = new URLSearchParams({ limit: '500' });

  if (status) query.set('status', status);

  return getJson(`/backup-jobs/${jobId}/items?${query}`);
}

export function getBackupCoverage(
  sourceId: string,
  destinationId: string,
  bucket?: BackupCoverageBucket,
): Promise<BackupCoverage> {
  const query = new URLSearchParams({ destinationId });

  if (bucket) query.set('bucket', bucket);

  return getJson(`/sources/${sourceId}/backup-coverage?${query}`);
}
