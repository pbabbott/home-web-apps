import {
  backupCoverageUrl,
  backupJobUrl,
  backupOverviewUrl,
  backupProgress,
  canCancelBackupJob,
  canRerunBackupJob,
  canRetryBackupItem,
  canRetryFailedBackupItems,
  coverageDownloadUrl,
  destinationStatus,
  isBlockingBucket,
  isActiveBackupJob,
  parseBackupItemStatus,
  parseCoverageBucket,
  planWarningText,
  stalledReasonText,
} from '../../src/app/exodus/lib/backup-display';
import type {
  BackupDestination,
  BackupJob,
  BackupJobProgress,
  BackupJobStatus,
} from '../../src/app/exodus/sources/lib/homelab-api';

const progress = (
  overrides: Partial<BackupJobProgress> = {},
  counts: Partial<BackupJobProgress['itemCounts']> = {},
): BackupJobProgress => ({
  itemCounts: {
    queued: 0,
    in_progress: 0,
    verified: 0,
    failed: 0,
    blocked: 0,
    skipped: 0,
    excluded: 0,
    ...counts,
  },
  entryCounts: { pending: 0, verified: 0, failed: 0, not_followed: 0 },
  verifiedBytes: 0,
  estimatedBytes: 0,
  unestimatedItems: 0,
  staleClaims: 0,
  lastActivityAt: null,
  ...overrides,
});

const job = (
  status: BackupJobStatus,
  counts: Partial<BackupJobProgress['itemCounts']> = {},
): Pick<BackupJob, 'status' | 'progress'> => ({
  status,
  progress: progress({}, counts),
});

const destination = (
  overrides: Partial<BackupDestination> = {},
): BackupDestination => ({
  id: 'd1',
  name: 'Dump',
  connectionType: 'nfs',
  hostId: 'h1',
  host: { id: 'h1', name: 'nas', ipAddress: '192.168.4.124' },
  settings: { exportPath: '/volume1/Dump' },
  rootDir: null,
  enabled: true,
  health: 'ok',
  lastValidatedAt: null,
  lastValidation: null,
  validationRequestedAt: null,
  workerSeenAt: null,
  claimedBy: null,
  claimedUntil: null,
  workerStale: false,
  ...overrides,
});

describe('isActiveBackupJob', () => {
  it.each([
    ['planned', true],
    ['running', true],
    ['completed', false],
    ['completed_with_issues', false],
    ['failed', false],
    ['cancelled', false],
  ] as const)('%s -> %p', (status, expected) => {
    expect(isActiveBackupJob({ status })).toBe(expected);
  });
});

describe('stalledReasonText', () => {
  it('explains each pause and says no attempts are spent', () => {
    expect(stalledReasonText('source_unreachable')).toMatch(/source machine/);
    expect(stalledReasonText('source_unreachable')).toMatch(/no attempts/);
    expect(stalledReasonText('destination_unhealthy')).toMatch(/NAS/);
    expect(stalledReasonText('destination_unhealthy')).toMatch(/no attempts/);
    expect(stalledReasonText('destination_disabled')).toMatch(/disabled/);
  });
});

describe('destinationStatus', () => {
  it('is healthy when the worker says ok', () => {
    expect(destinationStatus(destination())).toMatchObject({
      label: 'Healthy',
      color: 'success',
      noWorker: false,
      validationPending: false,
    });
  });

  it('flags a missing worker and a pending validation', () => {
    const status = destinationStatus(
      destination({
        workerStale: true,
        validationRequestedAt: '2026-10-28T10:00:00Z',
      }),
    );

    expect(status.noWorker).toBe(true);
    expect(status.validationPending).toBe(true);
  });

  it('lists the failed checks with their messages', () => {
    const status = destinationStatus(
      destination({
        health: 'unhealthy',
        lastValidation: {
          ok: false,
          checks: [
            { name: 'mount', ok: true },
            { name: 'probe', ok: false, message: 'EACCES' },
            { name: 'root', ok: false },
          ],
        },
      }),
    );

    expect(status).toMatchObject({ label: 'Unhealthy', color: 'error' });
    expect(status.failedChecks).toEqual(['probe: EACCES', 'root']);
  });

  it('says disabled before anything else, and unknown when never validated', () => {
    expect(destinationStatus(destination({ enabled: false })).label).toBe(
      'Disabled',
    );
    expect(destinationStatus(destination({ health: 'unknown' })).label).toBe(
      'Not validated yet',
    );
  });
});

describe('backupProgress', () => {
  it('counts verified, skipped and excluded items as done', () => {
    const summary = backupProgress(
      progress(
        {
          entryCounts: { pending: 3, verified: 7, failed: 0, not_followed: 0 },
          verifiedBytes: 5 * 1024 * 1024,
          estimatedBytes: 10 * 1024 * 1024,
        },
        { verified: 2, skipped: 1, excluded: 1, queued: 4 },
      ),
    );

    expect(summary).toMatchObject({
      itemsDone: 4,
      itemsTotal: 8,
      itemFraction: 0.5,
      files: '7 of 10 files and folders verified',
      bytes: '5.0 MB copied of about 10 MB',
      estimateIsFloor: false,
    });
  });

  it('calls the estimate a floor when items have none', () => {
    const summary = backupProgress(
      progress({ estimatedBytes: 2048, unestimatedItems: 2 }),
    );

    expect(summary.estimateIsFloor).toBe(true);
    expect(summary.bytes).toBe('0 B copied of about 2.0 KB or more');
  });

  it('treats an empty job as complete and omits an unknown estimate', () => {
    const summary = backupProgress(progress());

    expect(summary.itemFraction).toBe(1);
    expect(summary.bytes).toBe('0 B copied');
  });
});

describe('human actions', () => {
  it('cancels only an active job', () => {
    expect(canCancelBackupJob({ status: 'running' })).toBe(true);
    expect(canCancelBackupJob({ status: 'completed' })).toBe(false);
  });

  it('retries a failed or blocked item only while the job is active', () => {
    expect(
      canRetryBackupItem({ status: 'running' }, { status: 'failed' }),
    ).toBe(true);
    expect(
      canRetryBackupItem({ status: 'planned' }, { status: 'blocked' }),
    ).toBe(true);
    expect(
      canRetryBackupItem({ status: 'running' }, { status: 'verified' }),
    ).toBe(false);
    expect(
      canRetryBackupItem(
        { status: 'completed_with_issues' },
        { status: 'failed' },
      ),
    ).toBe(false);
  });

  it('offers retry-failed on an active job with unresolved items', () => {
    expect(canRetryFailedBackupItems(job('running', { failed: 1 }))).toBe(true);
    expect(canRetryFailedBackupItems(job('running', { blocked: 1 }))).toBe(
      true,
    );
    expect(canRetryFailedBackupItems(job('running'))).toBe(false);
    expect(
      canRetryFailedBackupItems(job('completed_with_issues', { failed: 1 })),
    ).toBe(false);
  });

  it('offers rerun on a finished job with unresolved items', () => {
    expect(canRerunBackupJob(job('completed_with_issues', { failed: 2 }))).toBe(
      true,
    );
    expect(canRerunBackupJob(job('cancelled', { blocked: 1 }))).toBe(true);
    expect(canRerunBackupJob(job('completed'))).toBe(false);
    expect(canRerunBackupJob(job('running', { failed: 1 }))).toBe(false);
  });
});

describe('planWarningText', () => {
  it('words each warning code', () => {
    expect(
      planWarningText({ code: 'discovery_job_active', message: 'x' }),
    ).toMatch(/discovery job/);
    expect(
      planWarningText({ code: 'destination_folder_exists', message: 'x' }),
    ).toMatch(/never overwritten/);
    expect(
      planWarningText({ code: 'destination_folder_unknown', message: 'x' }),
    ).toMatch(/not been validated/);
  });
});

describe('coverage buckets', () => {
  it('blocks "all accounted" the way the API does', () => {
    expect(
      (
        [
          'undecided',
          'pending',
          'failed',
          'blocked',
          'never_attempted',
        ] as const
      ).every(isBlockingBucket),
    ).toBe(true);
    expect(
      (['covered', 'redundant_covered', 'excluded_rule', 'rejected'] as const)
        .map(isBlockingBucket)
        .some(Boolean),
    ).toBe(false);
  });

  it('parses a bucket and an item status from the URL', () => {
    expect(parseCoverageBucket('failed')).toBe('failed');
    expect(parseCoverageBucket('nope')).toBeUndefined();
    expect(parseBackupItemStatus('blocked')).toBe('blocked');
    expect(parseBackupItemStatus(undefined)).toBeUndefined();
  });
});

describe('urls', () => {
  it('builds the page links, leaving defaults out', () => {
    expect(backupOverviewUrl()).toBe('/exodus/backup');
    expect(backupOverviewUrl('s1', 'd1')).toBe(
      '/exodus/backup?source=s1&destination=d1',
    );
    expect(backupJobUrl('j1')).toBe('/exodus/backup/j1');
    expect(backupJobUrl('j1', 'failed')).toBe(
      '/exodus/backup/j1?status=failed',
    );
    expect(backupCoverageUrl('s1', 'd1', 'failed')).toBe(
      '/exodus/backup/coverage?source=s1&destination=d1&bucket=failed',
    );
    expect(coverageDownloadUrl('s1', 'd1')).toBe(
      '/exodus/backup/coverage/download?sourceId=s1&destinationId=d1',
    );
  });
});
