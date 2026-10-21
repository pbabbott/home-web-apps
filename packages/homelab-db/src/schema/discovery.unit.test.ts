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
    reason: null,
    result: null,
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

describe('retryDelaySeconds', () => {
  it('backs off exponentially from 30s', () => {
    expect([1, 2, 3, 4].map(retryDelaySeconds)).toEqual([30, 60, 120, 240]);
  });

  it('caps at one hour', () => {
    expect(retryDelaySeconds(20)).toBe(3600);
  });
});

describe('inventoryItemSelectSchema', () => {
  const row = {
    id,
    sourceId: id,
    firstJobId: id,
    lastJobId: id,
    kind: 'directory',
    rootPath: 'C:\\code\\project-a',
    normalizedRootPath: 'c:\\code\\project-a',
    displayName: 'project-a',
    summary: 'Git repository with local changes',
    recommendation: 'back_up',
    confidence: 'high',
    recommendationReason: 'Uncommitted changes exist only locally',
    evidence: {
      contentKinds: ['source_code'],
      git: null,
      reproducible: 'no',
      sufficientInformation: true,
      observations: [],
      openQuestions: [],
    },
    recommendedAt: new Date(),
    recommendedBy: 'openclaw-1',
    decision: 'pending',
    decisionNote: null,
    decidedAt: null,
    decidedBy: null,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('accepts a pending inventory item', () => {
    expect(inventoryItemSelectSchema.safeParse(row).success).toBe(true);
  });

  it.each(['back_up', 'skip', 'needs_review'])(
    'accepts recommendation %s',
    (recommendation) => {
      expect(
        inventoryItemSelectSchema.safeParse({ ...row, recommendation }).success,
      ).toBe(true);
    },
  );

  it('rejects an unknown confidence or decision', () => {
    expect(
      inventoryItemSelectSchema.safeParse({ ...row, confidence: 0.9 }).success,
    ).toBe(false);
    expect(
      inventoryItemSelectSchema.safeParse({ ...row, decision: 'maybe' })
        .success,
    ).toBe(false);
  });
});
