import {
  sourceSelectSchema,
  discoveryJobSelectSchema,
  discoveryQueueItemSelectSchema,
  inventoryItemSelectSchema,
} from './discovery';
import { retryDelaySeconds } from '../queries/discovery';

const id = '123e4567-e89b-12d3-a456-426614174000';

describe('sourceSelectSchema', () => {
  const row = {
    id,
    name: 'win11-desktop',
    hostId: id,
    sourceType: 'windows',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('accepts a realistic row shape', () => {
    expect(sourceSelectSchema.safeParse(row).success).toBe(true);
  });

  it('accepts a source with no host', () => {
    expect(sourceSelectSchema.safeParse({ ...row, hostId: null }).success).toBe(
      true,
    );
  });

  it('rejects an unknown sourceType', () => {
    expect(
      sourceSelectSchema.safeParse({ ...row, sourceType: 'linux' }).success,
    ).toBe(false);
  });
});

describe('discoveryJobSelectSchema', () => {
  const row = {
    id,
    sourceId: id,
    rootPath: 'C:\\Users\\You',
    normalizedRootPath: 'c:\\users\\you',
    status: 'pending',
    error: null,
    createdAt: new Date(),
    startedAt: null,
    finishedAt: null,
    updatedAt: new Date(),
  };

  it('accepts a pending job with null timestamps', () => {
    expect(discoveryJobSelectSchema.safeParse(row).success).toBe(true);
  });

  it.each(['pending', 'running', 'completed', 'failed', 'cancelled'])(
    'accepts status %s',
    (status) => {
      expect(
        discoveryJobSelectSchema.safeParse({ ...row, status }).success,
      ).toBe(true);
    },
  );

  it('rejects an unknown status', () => {
    expect(
      discoveryJobSelectSchema.safeParse({ ...row, status: 'paused' }).success,
    ).toBe(false);
  });
});

describe('discoveryQueueItemSelectSchema', () => {
  const row = {
    id,
    jobId: id,
    path: 'C:\\Users\\You\\Documents',
    normalizedPath: 'c:\\users\\you\\documents',
    status: 'queued',
    priority: 0,
    attemptCount: 0,
    maxAttempts: 3,
    lastError: null,
    availableAt: new Date(),
    claimedBy: null,
    claimToken: null,
    leaseExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };

  it('accepts a queued item', () => {
    expect(discoveryQueueItemSelectSchema.safeParse(row).success).toBe(true);
  });

  it('requires a job: an item belongs to exactly one', () => {
    expect(
      discoveryQueueItemSelectSchema.safeParse({ ...row, jobId: null }).success,
    ).toBe(false);
  });

  it('rejects an unknown status', () => {
    expect(
      discoveryQueueItemSelectSchema.safeParse({ ...row, status: 'running' })
        .success,
    ).toBe(false);
  });
});

describe('inventoryItemSelectSchema', () => {
  const row = {
    id,
    sourceId: id,
    firstJobId: id,
    lastJobId: id,
    itemType: 'file',
    path: 'C:\\Users\\You\\Report.pdf',
    normalizedPath: 'c:\\users\\you\\report.pdf',
    parentPath: 'C:\\Users\\You',
    normalizedParentPath: 'c:\\users\\you',
    name: 'Report.pdf',
    extension: 'pdf',
    sizeBytes: 4_000_000_000,
    modifiedAt: new Date(),
    reviewDisposition: 'needs_review',
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('accepts a file, including a size beyond 32 bits', () => {
    expect(inventoryItemSelectSchema.safeParse(row).success).toBe(true);
  });

  it('accepts a reviewed item and rejects an unknown disposition', () => {
    expect(
      inventoryItemSelectSchema.safeParse({
        ...row,
        reviewDisposition: 'candidate',
        reviewedAt: new Date(),
        reviewedBy: 'brandon',
        reviewNote: 'tax records',
      }).success,
    ).toBe(true);
    expect(
      inventoryItemSelectSchema.safeParse({
        ...row,
        reviewDisposition: 'maybe',
      }).success,
    ).toBe(false);
  });

  it('accepts a directory with no size, mtime or extension', () => {
    expect(
      inventoryItemSelectSchema.safeParse({
        ...row,
        itemType: 'directory',
        sizeBytes: null,
        modifiedAt: null,
        extension: null,
      }).success,
    ).toBe(true);
  });

  it('accepts a root with no parent and a job that was deleted', () => {
    expect(
      inventoryItemSelectSchema.safeParse({
        ...row,
        parentPath: null,
        normalizedParentPath: null,
        firstJobId: null,
        lastJobId: null,
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown itemType', () => {
    expect(
      inventoryItemSelectSchema.safeParse({ ...row, itemType: 'symlink' })
        .success,
    ).toBe(false);
  });
});

describe('retryDelaySeconds', () => {
  it('backs off exponentially from 30s', () => {
    expect([1, 2, 3, 4].map(retryDelaySeconds)).toEqual([30, 60, 120, 240]);
  });

  it('caps at one hour', () => {
    expect(retryDelaySeconds(20)).toBe(3600);
  });
});
