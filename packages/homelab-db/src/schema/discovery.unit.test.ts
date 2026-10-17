import {
  backupSourceSelectSchema,
  discoveryJobSelectSchema,
  discoveryQueueItemSelectSchema,
} from './discovery';
import { retryDelaySeconds } from '../queries/discovery';

const id = '123e4567-e89b-12d3-a456-426614174000';

describe('backupSourceSelectSchema', () => {
  const row = {
    id,
    name: 'win11-desktop',
    hostId: id,
    sourceType: 'windows',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('accepts a realistic row shape', () => {
    expect(backupSourceSelectSchema.safeParse(row).success).toBe(true);
  });

  it('accepts a source with no host', () => {
    expect(
      backupSourceSelectSchema.safeParse({ ...row, hostId: null }).success,
    ).toBe(true);
  });

  it('rejects an unknown sourceType', () => {
    expect(
      backupSourceSelectSchema.safeParse({ ...row, sourceType: 'linux' })
        .success,
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
    sourceId: id,
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

  it('accepts an item with no job', () => {
    expect(
      discoveryQueueItemSelectSchema.safeParse({ ...row, jobId: null }).success,
    ).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(
      discoveryQueueItemSelectSchema.safeParse({ ...row, status: 'running' })
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
