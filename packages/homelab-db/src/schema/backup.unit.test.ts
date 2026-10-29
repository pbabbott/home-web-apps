import {
  backupDestinationSelectSchema,
  backupJobSelectSchema,
  backupJobItemSelectSchema,
  backupEntrySelectSchema,
} from './backup';

const id = '123e4567-e89b-12d3-a456-426614174000';
const now = new Date();

describe('backupDestinationSelectSchema', () => {
  const row = {
    id,
    name: 'dump',
    hostId: id,
    connectionType: 'nfs',
    settings: { exportPath: '/volume1/Dump' },
    rootDir: null,
    enabled: true,
    health: 'unknown',
    lastValidatedAt: null,
    lastValidation: null,
    validationRequestedAt: null,
    workerSeenAt: null,
    claimedBy: null,
    claimedUntil: null,
    createdAt: now,
    updatedAt: now,
  };

  it('accepts a fresh destination', () => {
    expect(backupDestinationSelectSchema.safeParse(row).success).toBe(true);
  });

  it.each(['unknown', 'ok', 'unhealthy'])('accepts health %s', (health) => {
    expect(
      backupDestinationSelectSchema.safeParse({ ...row, health }).success,
    ).toBe(true);
  });

  it('rejects an unknown connection type', () => {
    expect(
      backupDestinationSelectSchema.safeParse({ ...row, connectionType: 'smb' })
        .success,
    ).toBe(false);
  });
});

describe('backupJobSelectSchema', () => {
  const row = {
    id,
    sourceId: id,
    destinationId: id,
    status: 'planned',
    stalledReason: null,
    stalledSince: null,
    selection: { skipAlreadyCovered: true },
    sourceDirName: 'alpha-centauri',
    error: null,
    createdBy: null,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    updatedAt: now,
  };

  it.each([
    'planned',
    'running',
    'completed',
    'completed_with_issues',
    'failed',
    'cancelled',
  ])('accepts status %s', (status) => {
    expect(backupJobSelectSchema.safeParse({ ...row, status }).success).toBe(
      true,
    );
  });

  it('rejects an unknown stalled reason', () => {
    expect(
      backupJobSelectSchema.safeParse({ ...row, stalledReason: 'tired' })
        .success,
    ).toBe(false);
  });
});

describe('backupJobItemSelectSchema', () => {
  const row = {
    id,
    jobId: id,
    inventoryItemId: id,
    kind: 'file',
    rootPath: 'C:\\backup-test\\a.zip',
    normalizedRootPath: 'c:\\backup-test\\a.zip',
    destRelPath: 'alpha-centauri/C/backup-test/a.zip',
    carveOuts: [],
    coveredByJobItemId: null,
    estimatedSizeBytes: null,
    status: 'queued',
    statusReason: null,
    attemptCount: 0,
    maxAttempts: 3,
    availableAt: now,
    claimedBy: null,
    lastClaimedBy: null,
    claimToken: null,
    leaseExpiresAt: null,
    lastError: null,
    enumerationComplete: false,
    enumeratedAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  it.each([
    'queued',
    'in_progress',
    'verified',
    'failed',
    'blocked',
    'skipped',
    'excluded',
  ])('accepts status %s', (status) => {
    expect(
      backupJobItemSelectSchema.safeParse({ ...row, status }).success,
    ).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(
      backupJobItemSelectSchema.safeParse({ ...row, status: 'completed' })
        .success,
    ).toBe(false);
  });
});

describe('backupEntrySelectSchema', () => {
  const row = {
    id: 1,
    jobItemId: id,
    relPath: '',
    normalizedRelPath: '',
    entryType: 'file',
    status: 'pending',
    issueKind: null,
    message: null,
    sizeBytes: null,
    sha256: null,
    destRelPath: null,
    srcCreatedAt: null,
    srcModifiedAt: null,
    srcAccessedAt: null,
    srcChangedAt: null,
    srcAttributes: null,
    srcStreams: null,
    srcZoneIdentifier: null,
    attempt: 0,
    verifiedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  it('accepts a pending entry', () => {
    expect(backupEntrySelectSchema.safeParse(row).success).toBe(true);
  });

  it('accepts a not_followed entry with its issue kind', () => {
    expect(
      backupEntrySelectSchema.safeParse({
        ...row,
        status: 'not_followed',
        issueKind: 'reparse_point_not_followed',
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown issue kind', () => {
    expect(
      backupEntrySelectSchema.safeParse({ ...row, issueKind: 'oops' }).success,
    ).toBe(false);
  });
});
