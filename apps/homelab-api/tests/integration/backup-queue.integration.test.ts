import {
  BackupError,
  claimNextBackupItem,
  completeBackupItem,
  failBackupItem,
  heartbeatBackupItem,
  markBackupEnumerationComplete,
  releaseBackupItem,
  retryBackupJobItem,
  retryFailedBackupJobItems,
  transitionBackupJob,
  upsertBackupEntries,
} from '@abbottland/homelab-db';
import { db } from '../../src/db';
import {
  HUMAN,
  auditCount,
  cleanupBackupFixtures,
  expireLease,
  itemRow,
  makeJob,
} from './fixtures/backup';

afterEach(cleanupBackupFixtures);

// Race tests loop many concurrent calls; jest's 5s default is too tight on slow runners.
const RACE_TEST_TIMEOUT_MS = 30_000;

const claim = (destinationId: string, workerId = 'worker-a') =>
  claimNextBackupItem(db, { destinationId, workerId, leaseSeconds: 300 });

const claimed = async (destinationId: string, workerId?: string) => {
  const result = await claim(destinationId, workerId);
  if (!('job' in result)) throw new Error(`nothing to claim: ${result.reason}`);

  return result;
};

const rejects = async (promise: Promise<unknown>, code: string) => {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(BackupError);
  expect((err as BackupError).code).toBe(code);
};

describe('claiming', () => {
  it(
    'never hands the same item to two concurrent claimers',
    async () => {
      const { destination } = await makeJob(12);

      const results = await Promise.all(
        Array.from({ length: 24 }, (_, i) =>
          claim(destination.id, `worker-${i}`),
        ),
      );
      const items = results.flatMap((r) => ('job' in r ? [r.item.id] : []));

      expect(items).toHaveLength(12);
      expect(new Set(items).size).toBe(12);
      expect(results.filter((r) => !('job' in r))).toHaveLength(12);
    },
    RACE_TEST_TIMEOUT_MS,
  );

  it('moves the job from planned to running on the first claim and audits it once', async () => {
    const { destination, job } = await makeJob(2);

    const first = await claimed(destination.id);
    await claimed(destination.id);

    expect(first.job.status).toBe('running');
    expect(first.item.attemptCount).toBe(1);
    expect(
      await auditCount('backup_job.started', { backupJobId: job.id }),
    ).toBe(1);
  });

  it('says why nothing can be claimed', async () => {
    const { destination } = await makeJob(1);
    await claimed(destination.id);

    const idle = await claim(destination.id, 'worker-b');

    expect(idle).toMatchObject({ item: null, reason: 'in_progress' });
    expect('retryAt' in idle && idle.retryAt).toBeInstanceOf(Date);
  });

  it('answers queue_empty with the drained job ids once everything is settled', async () => {
    const { destination, job } = await makeJob(1);
    const { item } = await claimed(destination.id);
    await markBackupEnumerationComplete(db, item.id, {
      claimToken: item.claimToken as string,
    });
    await completeBackupItem(db, item.id, {
      claimToken: item.claimToken as string,
    });

    const idle = await claim(destination.id);

    expect(idle).toMatchObject({
      item: null,
      reason: 'queue_empty',
      drainedJobIds: [job.id],
    });
  });

  it('hands out nothing for a disabled or unhealthy destination, or a stalled job', async () => {
    const { destination, job } = await makeJob(1);

    await db.$client.query(
      "update backup_destinations set health = 'unhealthy' where id = $1",
      [destination.id],
    );
    expect(await claim(destination.id)).toMatchObject({
      reason: 'destination_unhealthy',
    });

    await db.$client.query(
      "update backup_destinations set health = 'ok', enabled = false where id = $1",
      [destination.id],
    );
    expect(await claim(destination.id)).toMatchObject({
      reason: 'destination_disabled',
    });

    await db.$client.query(
      'update backup_destinations set enabled = true where id = $1',
      [destination.id],
    );
    await db.$client.query(
      "update backup_jobs set stalled_reason = 'source_unreachable', stalled_since = now() where id = $1",
      [job.id],
    );
    expect(await claim(destination.id)).toMatchObject({
      reason: 'source_unreachable',
    });
  });
});

describe('leases', () => {
  it('requeues an expired lease, spends the attempt and fails on the last one', async () => {
    const { destination, job } = await makeJob(1);

    const first = await claimed(destination.id, 'worker-a');
    expect(first.item.attemptCount).toBe(1);

    await expireLease(first.item.id);
    const second = await claimed(destination.id, 'worker-b');
    expect(second.item.id).toBe(first.item.id);
    expect(second.item.attemptCount).toBe(2);
    expect(second.item.claimToken).not.toBe(first.item.claimToken);

    await expireLease(second.item.id);
    const third = await claimed(destination.id, 'worker-c');
    expect(third.item.attemptCount).toBe(3);

    await expireLease(third.item.id);
    const idle = await claim(destination.id, 'worker-d');

    expect(idle).toMatchObject({ item: null, reason: 'queue_empty' });
    const row = await itemRow(first.item.id);
    expect(row.status).toBe('failed');
    expect(row.lastError).toContain('on final attempt');
    expect(
      await auditCount('backup_job_items.lease_expired', {
        backupJobId: job.id,
      }),
    ).toBe(3);
  });

  it('rejects a heartbeat from the worker whose lease was taken over', async () => {
    const { destination } = await makeJob(1);
    const first = await claimed(destination.id, 'worker-a');
    await expireLease(first.item.id);
    await claimed(destination.id, 'worker-b');

    await rejects(
      heartbeatBackupItem(db, first.item.id, {
        claimToken: first.item.claimToken as string,
        leaseSeconds: 300,
      }),
      'conflict',
    );
  });
});

describe('finishing an item', () => {
  it('completes idempotently with the same token and conflicts for another', async () => {
    const { destination } = await makeJob(1);
    const { item } = await claimed(destination.id);
    const claimToken = item.claimToken as string;
    await markBackupEnumerationComplete(db, item.id, { claimToken });

    const first = await completeBackupItem(db, item.id, { claimToken });
    const again = await completeBackupItem(db, item.id, { claimToken });

    expect(first.status).toBe('verified');
    expect(again.id).toBe(first.id);
    expect(again.completedAt).toEqual(first.completedAt);
    await rejects(
      completeBackupItem(db, item.id, {
        claimToken: '00000000-0000-4000-8000-000000000000',
      }),
      'conflict',
    );
  });

  it('refuses to verify while enumeration is incomplete or an entry is unresolved', async () => {
    const { destination } = await makeJob(1);
    const { item } = await claimed(destination.id);
    const claimToken = item.claimToken as string;

    await rejects(completeBackupItem(db, item.id, { claimToken }), 'conflict');

    await upsertBackupEntries(db, item.id, {
      claimToken,
      entries: [
        { relPath: '', normalizedRelPath: '', entryType: 'file', sizeBytes: 5 },
      ],
    });
    await markBackupEnumerationComplete(db, item.id, { claimToken });

    await rejects(completeBackupItem(db, item.id, { claimToken }), 'conflict');
    expect((await itemRow(item.id)).status).toBe('in_progress');
  });

  it('requeues a transient failure behind a backoff, then fails when attempts run out', async () => {
    const { destination, job } = await makeJob(1);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { item } = await claimed(destination.id);
      const failed = await failBackupItem(db, item.id, {
        claimToken: item.claimToken as string,
        error: `read_failed ${attempt}`,
        kind: 'transient',
      });

      if (attempt < 3) {
        expect(failed.status).toBe('queued');
        expect(failed.availableAt.getTime()).toBeGreaterThan(Date.now());
        expect(await claim(destination.id)).toMatchObject({
          reason: 'retry_backoff',
        });
        await db.$client.query(
          'update backup_job_items set available_at = now() where id = $1',
          [item.id],
        );
      } else {
        expect(failed.status).toBe('failed');
      }
    }

    expect(
      await auditCount('backup_job_item.attempt_failed', {
        backupJobId: job.id,
      }),
    ).toBe(2);
    expect(
      await auditCount('backup_job_item.failed', { backupJobId: job.id }),
    ).toBe(1);
  });

  it('blocks a permanent failure at once and answers a repeat from the settled row', async () => {
    const { destination } = await makeJob(1);
    const { item } = await claimed(destination.id);
    const input = {
      claimToken: item.claimToken as string,
      error: 'source_missing',
      kind: 'permanent' as const,
    };

    const first = await failBackupItem(db, item.id, input);
    const again = await failBackupItem(db, item.id, input);

    expect(first.status).toBe('blocked');
    expect(again.id).toBe(first.id);
  });

  it('refunds the attempt when a worker releases its claim', async () => {
    const { destination } = await makeJob(1);
    const { item } = await claimed(destination.id);

    const released = await releaseBackupItem(db, item.id, {
      claimToken: item.claimToken as string,
    });

    expect(released.status).toBe('queued');
    expect(released.attemptCount).toBe(0);
    expect(released.claimToken).toBeNull();
  });
});

describe('cancelling', () => {
  it('rejects a late worker after the job is cancelled and keeps the item queued', async () => {
    const { destination, job } = await makeJob(1);
    const { item } = await claimed(destination.id);
    const claimToken = item.claimToken as string;
    await markBackupEnumerationComplete(db, item.id, { claimToken });

    await transitionBackupJob(db, job.id, 'cancelled', HUMAN);

    await rejects(
      heartbeatBackupItem(db, item.id, { claimToken, leaseSeconds: 300 }),
      'conflict',
    );
    await rejects(completeBackupItem(db, item.id, { claimToken }), 'conflict');
    await rejects(
      failBackupItem(db, item.id, {
        claimToken,
        error: 'x',
        kind: 'transient',
      }),
      'conflict',
    );
    await rejects(releaseBackupItem(db, item.id, { claimToken }), 'conflict');
    expect((await itemRow(item.id)).status).toBe('queued');
    expect(await claim(destination.id)).toMatchObject({
      reason: 'queue_empty',
    });
  });

  it('refuses to cancel a job that is already final', async () => {
    const { job } = await makeJob(1);
    await transitionBackupJob(db, job.id, 'cancelled', HUMAN);

    await rejects(transitionBackupJob(db, job.id, 'failed', HUMAN), 'conflict');
    expect(
      await auditCount('backup_job.cancelled', { backupJobId: job.id }),
    ).toBe(1);
    expect(await auditCount('backup_job.failed', { backupJobId: job.id })).toBe(
      0,
    );
  });
});

describe('human retry', () => {
  it('grants exactly one more attempt, and only while the job is active', async () => {
    const { destination, job } = await makeJob(1);
    const { item } = await claimed(destination.id);
    await failBackupItem(db, item.id, {
      claimToken: item.claimToken as string,
      error: 'dest_conflict',
      kind: 'permanent',
    });

    const retried = await retryBackupJobItem(db, item.id, HUMAN);
    expect(retried.status).toBe('queued');
    expect(retried.maxAttempts).toBe(retried.attemptCount + 1);

    const second = await claimed(destination.id);
    expect(second.item.attemptCount).toBe(2);
    await failBackupItem(db, item.id, {
      claimToken: second.item.claimToken as string,
      error: 'again',
      kind: 'transient',
    });
    expect((await itemRow(item.id)).status).toBe('failed');

    await transitionBackupJob(db, job.id, 'cancelled', HUMAN);
    await rejects(retryBackupJobItem(db, item.id, HUMAN), 'conflict');
    await rejects(retryFailedBackupJobItems(db, job.id, HUMAN), 'conflict');
  });

  it('refuses to retry an item that has not failed', async () => {
    const { job } = await makeJob(1);
    const { rows } = await db.$client.query(
      'select id from backup_job_items where job_id = $1',
      [job.id],
    );

    await rejects(retryBackupJobItem(db, rows[0].id, HUMAN), 'conflict');
  });
});
