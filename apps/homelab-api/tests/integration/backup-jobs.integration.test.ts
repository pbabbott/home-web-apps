import {
  BackupError,
  claimNextBackupItem,
  completeBackupItem,
  completeBackupJobIfDone,
  createBackupJob,
  failBackupItem,
  getBackupJobSummaries,
  listAuditEvents,
  markBackupEnumerationComplete,
  recordBackupDestinationValidation,
  requestBackupDestinationValidation,
  resumeBackupJob,
  setBackupDestinationEnabled,
  stallBackupJob,
  updateBackupDestination,
} from '@abbottland/homelab-db';
import { db } from '../../src/db';
import {
  HUMAN,
  WORKER,
  auditCount,
  cleanupBackupFixtures,
  itemRow,
  makeDestination,
  makeInventoryItem,
  makeJob,
  makeSource,
  planned,
  sqlState,
} from './fixtures/backup';

afterEach(cleanupBackupFixtures);

const claimAndSettle = async (
  destinationId: string,
  outcome: 'verified' | 'failed' | 'blocked',
) => {
  const result = await claimNextBackupItem(db, {
    destinationId,
    workerId: WORKER.id,
    leaseSeconds: 300,
  });
  if (!('job' in result)) throw new Error(`nothing to claim: ${result.reason}`);
  const claimToken = result.item.claimToken as string;

  if (outcome === 'verified') {
    await markBackupEnumerationComplete(db, result.item.id, { claimToken });
    await completeBackupItem(db, result.item.id, { claimToken });
  } else {
    await failBackupItem(db, result.item.id, {
      claimToken,
      error: outcome,
      kind: 'permanent',
    });
  }
};

const rejectsWith = async (promise: Promise<unknown>, code: string) => {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(BackupError);
  expect((err as BackupError).code).toBe(code);
};

describe('creating a job', () => {
  it('freezes the scope, sets attempts by kind and audits the creation once', async () => {
    const sourceId = await makeSource();
    const destination = await makeDestination();
    const file = await makeInventoryItem(sourceId, 'C:\\a\\one.txt');
    const dir = await makeInventoryItem(sourceId, 'C:\\a\\dir', {
      kind: 'directory',
    });
    const nested = await makeInventoryItem(sourceId, 'C:\\a\\dir\\inner.txt');

    const job = await createBackupJob(
      db,
      {
        sourceId,
        destinationId: destination.id,
        selection: { skipAlreadyCovered: true },
        sourceDirName: 'test-source',
        items: [
          planned(file),
          planned(dir),
          planned(nested, {
            status: 'skipped',
            statusReason: 'redundant_nested',
            coveredByInventoryItemId: dir.id,
          }),
        ],
      },
      HUMAN,
    );

    const { rows } = await db.$client.query(
      'select kind, max_attempts, status, status_reason, covered_by_job_item_id, inventory_item_id from backup_job_items where job_id = $1 order by normalized_root_path',
      [job.id],
    );
    const byInventory = new Map(rows.map((r) => [r.inventory_item_id, r]));
    expect(byInventory.get(file.id).max_attempts).toBe(3);
    expect(byInventory.get(dir.id).max_attempts).toBe(5);
    expect(byInventory.get(nested.id)).toMatchObject({
      status: 'skipped',
      status_reason: 'redundant_nested',
    });
    expect(byInventory.get(nested.id).covered_by_job_item_id).not.toBeNull();
    expect(
      await auditCount('backup_job.created', { backupJobId: job.id }),
    ).toBe(1);
  });

  it('refuses a second active job for the same source and destination', async () => {
    const { sourceId, destination, inventory } = await makeJob(1);

    await rejectsWith(
      createBackupJob(
        db,
        {
          sourceId,
          destinationId: destination.id,
          selection: {},
          sourceDirName: 'test-source',
          items: inventory.map((item) => planned(item)),
        },
        HUMAN,
      ),
      'conflict',
    );
    const { rows } = await db.$client.query(
      'select count(*)::int as n from backup_jobs where source_id = $1',
      [sourceId],
    );
    expect(rows[0].n).toBe(1);
  });

  it('writes nothing for a rejected request: empty, disabled destination, unknown destination', async () => {
    const sourceId = await makeSource();
    const item = await makeInventoryItem(sourceId, 'C:\\a.txt');
    const destination = await makeDestination({ enabled: false });
    const events = async () => (await listAuditEvents(db, { sourceId })).length;
    const before = await events();

    await rejectsWith(
      createBackupJob(
        db,
        {
          sourceId,
          destinationId: destination.id,
          selection: {},
          sourceDirName: 'x',
          items: [],
        },
        HUMAN,
      ),
      'conflict',
    );
    await rejectsWith(
      createBackupJob(
        db,
        {
          sourceId,
          destinationId: destination.id,
          selection: {},
          sourceDirName: 'x',
          items: [planned(item)],
        },
        HUMAN,
      ),
      'conflict',
    );
    await rejectsWith(
      createBackupJob(
        db,
        {
          sourceId,
          destinationId: '00000000-0000-4000-8000-000000000000',
          selection: {},
          sourceDirName: 'x',
          items: [planned(item)],
        },
        HUMAN,
      ),
      'not_found',
    );

    expect(await events()).toBe(before);
    const { rows } = await db.$client.query(
      'select count(*)::int as n from backup_jobs where source_id = $1',
      [sourceId],
    );
    expect(rows[0].n).toBe(0);
  });

  it('does not change a running job when inventory changes afterwards', async () => {
    const { sourceId, job } = await makeJob(2);
    await makeInventoryItem(sourceId, 'C:\\data\\late.txt');
    await db.$client.query(
      "update inventory_items set decision = 'rejected' where source_id = $1",
      [sourceId],
    );

    const summaries = await getBackupJobSummaries(db, [job.id]);

    expect(summaries.get(job.id)?.itemCounts.queued).toBe(2);
  });
});

describe('job outcome', () => {
  it('completes when every item is verified', async () => {
    const { destination, job } = await makeJob(2);
    await claimAndSettle(destination.id, 'verified');
    await claimAndSettle(destination.id, 'verified');

    const { job: done, finished } = await completeBackupJobIfDone(
      db,
      job.id,
      WORKER,
    );

    expect(finished).toBe(true);
    expect(done.status).toBe('completed');
    expect(done.finishedAt).not.toBeNull();
    expect(
      await auditCount('backup_job.completed', { backupJobId: job.id }),
    ).toBe(1);
  });

  it('completes with issues when an item failed or is blocked', async () => {
    const { destination, job } = await makeJob(2);
    await claimAndSettle(destination.id, 'verified');
    await claimAndSettle(destination.id, 'blocked');

    const { job: done } = await completeBackupJobIfDone(db, job.id, WORKER);

    expect(done.status).toBe('completed_with_issues');
  });

  it('does nothing while work remains and again once the job is final', async () => {
    const { destination, job } = await makeJob(2);
    await claimAndSettle(destination.id, 'verified');

    const early = await completeBackupJobIfDone(db, job.id, WORKER);
    expect(early.finished).toBe(false);
    expect(early.job.status).toBe('running');

    await claimAndSettle(destination.id, 'verified');
    await completeBackupJobIfDone(db, job.id, WORKER);
    const again = await completeBackupJobIfDone(db, job.id, WORKER);

    expect(again.finished).toBe(false);
    expect(
      await auditCount('backup_job.completed', { backupJobId: job.id }),
    ).toBe(1);
  });
});

describe('stalling', () => {
  it('pauses claims without spending an attempt and resumes with one audit event each', async () => {
    const { destination, job } = await makeJob(1);

    await stallBackupJob(db, job.id, 'source_unreachable', WORKER);
    await stallBackupJob(db, job.id, 'source_unreachable', WORKER);
    const paused = await claimNextBackupItem(db, {
      destinationId: destination.id,
      workerId: WORKER.id,
      leaseSeconds: 300,
    });

    expect(paused).toMatchObject({ item: null, reason: 'source_unreachable' });
    const { rows } = await db.$client.query(
      'select id, attempt_count from backup_job_items where job_id = $1',
      [job.id],
    );
    expect(rows[0].attempt_count).toBe(0);
    expect(await itemRow(rows[0].id)).toMatchObject({ status: 'queued' });

    await resumeBackupJob(db, job.id, WORKER);
    await resumeBackupJob(db, job.id, WORKER);
    const resumed = await claimNextBackupItem(db, {
      destinationId: destination.id,
      workerId: WORKER.id,
      leaseSeconds: 300,
    });

    expect(resumed.item).not.toBeNull();
    expect(
      await auditCount('backup_job.stalled', { backupJobId: job.id }),
    ).toBe(1);
    expect(
      await auditCount('backup_job.resumed', { backupJobId: job.id }),
    ).toBe(1);
  });
});

describe('destinations', () => {
  it('records a validation result, clears the request and audits it', async () => {
    const destination = await makeDestination();

    const requested = await requestBackupDestinationValidation(
      db,
      destination.id,
    );
    expect(requested.validationRequestedAt).not.toBeNull();

    const validated = await recordBackupDestinationValidation(
      db,
      destination.id,
      {
        workerId: WORKER.id,
        validation: { ok: true, mountVerified: false },
      },
    );

    expect(validated.health).toBe('ok');
    expect(validated.validationRequestedAt).toBeNull();
    expect(validated.lastValidation).toMatchObject({ ok: true });
    expect(
      await auditCount('backup_destination.validated', {
        destinationId: destination.id,
      }),
    ).toBe(1);
  });

  it('keeps the destination identity fixed while a job is active, but allows renaming', async () => {
    const { destination } = await makeJob(1);

    await rejectsWith(
      updateBackupDestination(
        db,
        destination.id,
        { rootDir: 'elsewhere' },
        HUMAN,
      ),
      'conflict',
    );
    await rejectsWith(
      updateBackupDestination(
        db,
        destination.id,
        { settings: { server: '192.0.2.99', exportPath: '/volume1/Test' } },
        HUMAN,
      ),
      'conflict',
    );
    const renamed = await updateBackupDestination(
      db,
      destination.id,
      { name: `${destination.name}-renamed` },
      HUMAN,
    );
    expect(renamed.name).toContain('renamed');
  });

  it('keeps the identity fixed once data is verified, and allows it for an unused destination', async () => {
    const { destination, job } = await makeJob(1);
    await claimAndSettle(destination.id, 'verified');
    await completeBackupJobIfDone(db, job.id, WORKER);

    await rejectsWith(
      updateBackupDestination(db, destination.id, { rootDir: 'moved' }, HUMAN),
      'conflict',
    );

    const unused = await makeDestination();
    const moved = await updateBackupDestination(
      db,
      unused.id,
      { rootDir: 'moved' },
      HUMAN,
    );
    expect(moved.rootDir).toBe('moved');
  });

  it('audits enable and disable only when the state changes', async () => {
    const destination = await makeDestination();

    await setBackupDestinationEnabled(db, destination.id, true, HUMAN);
    await setBackupDestinationEnabled(db, destination.id, false, HUMAN);
    await setBackupDestinationEnabled(db, destination.id, false, HUMAN);

    const where = { destinationId: destination.id };
    expect(await auditCount('backup_destination.enabled', where)).toBe(0);
    expect(await auditCount('backup_destination.disabled', where)).toBe(1);
  });

  it('refuses to delete a destination that has jobs', async () => {
    const { destination } = await makeJob(1);

    expect(
      await sqlState('delete from backup_destinations where id = $1', [
        destination.id,
      ]),
    ).toBe('23503');
  });
});

describe('CHECK constraints', () => {
  const itemId = async () => {
    const { destination, job } = await makeJob(1);
    const { rows } = await db.$client.query(
      'select id from backup_job_items where job_id = $1',
      [job.id],
    );

    return { destination, job, itemId: rows[0].id as string };
  };

  it('requires the claim fields while in progress', async () => {
    const { itemId: id } = await itemId();

    expect(
      await sqlState(
        "update backup_job_items set status = 'in_progress' where id = $1",
        [id],
      ),
    ).toBe('23514');
  });

  it('requires completion and enumeration for verified', async () => {
    const { itemId: id } = await itemId();

    expect(
      await sqlState(
        "update backup_job_items set status = 'verified', completed_at = now() where id = $1",
        [id],
      ),
    ).toBe('23514');
  });

  it('keeps attempts within 0..max and max above zero', async () => {
    const { itemId: id } = await itemId();

    expect(
      await sqlState(
        'update backup_job_items set attempt_count = max_attempts + 1 where id = $1',
        [id],
      ),
    ).toBe('23514');
    expect(
      await sqlState(
        'update backup_job_items set max_attempts = 0 where id = $1',
        [id],
      ),
    ).toBe('23514');
  });

  it('requires hash and destination path for a verified file entry and an issue for a failed one', async () => {
    const { itemId: id } = await itemId();
    const insert = (status: string) =>
      sqlState(
        `insert into backup_entries (job_item_id, rel_path, normalized_rel_path, entry_type, status) values ($1, '', '', 'file', '${status}')`,
        [id],
      );

    expect(await insert('failed')).toBe('23514');
    expect(await insert('verified')).toBe('23514');
  });

  it('requires stalled reason and time together, and a finish time on final jobs', async () => {
    const { job } = await itemId();

    expect(
      await sqlState(
        "update backup_jobs set stalled_reason = 'source_unreachable' where id = $1",
        [job.id],
      ),
    ).toBe('23514');
    expect(
      await sqlState(
        "update backup_jobs set status = 'cancelled' where id = $1",
        [job.id],
      ),
    ).toBe('23514');
  });

  it('keeps root_dir relative with no parent segment', async () => {
    const name = (n: string) => `backup-check-${n}-${Math.random()}`;
    const insert = (rootDir: string) =>
      sqlState(
        "insert into backup_destinations (name, connection_type, settings, root_dir) values ($1, 'nfs', '{}', $2) returning id",
        [name('r'), rootDir],
      );

    expect(await insert('/absolute')).toBe('23514');
    expect(await insert('..')).toBe('23514');
    expect(await insert('a/../b')).toBe('23514');
    expect(await insert('a\\..\\b')).toBe('23514');
    expect(await insert('nested/dir')).toBeUndefined();
    expect(await insert('..hidden')).toBeUndefined();
    await db.$client.query(
      "delete from backup_destinations where name like 'backup-check-%'",
    );
  });
});
