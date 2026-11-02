import {
  completeBackupItem,
  completeBackupJobIfDone,
  failBackupItem,
  markBackupEnumerationComplete,
  upsertBackupEntries,
} from '@abbottland/homelab-db';
import { db } from '../../src/db';
import {
  WORKER,
  auditCount,
  makeDestination,
  makeInventoryItem,
  makeSource,
  api,
  claimOne,
  create,
  useBackupApiCleanup,
  verifyAll,
} from './fixtures/backup';

useBackupApiCleanup();

describe('jobs', () => {
  const makeApiJob = async () => {
    const sourceId = await makeSource();
    const destination = await makeDestination();
    await makeInventoryItem(sourceId, 'C:\\data\\a.txt');
    await makeInventoryItem(sourceId, 'C:\\data\\b.txt');
    const job = (
      await create(sourceId, { destinationId: destination.id }).expect(201)
    ).body;

    return { sourceId, destination, job };
  };

  it('creates a planned job, audited once, and a rejected create writes none', async () => {
    const { sourceId, destination, job } = await makeApiJob();

    expect(job).toMatchObject({
      status: 'planned',
      sourceId,
      destinationId: destination.id,
      createdBy: null,
    });
    const created = () =>
      auditCount('backup_job.created', { backupJobId: job.id });
    expect(await created()).toBe(1);

    await create(sourceId, { destinationId: destination.id }).expect(409);
    expect(
      (
        await db.$client.query(
          "select count(*)::int as n from audit_events where event_type = 'backup_job.created' and source_id = $1",
          [sourceId],
        )
      ).rows[0].n,
    ).toBe(1);
  });

  it('keeps the scope frozen when inventory changes afterwards', async () => {
    const { sourceId, destination, job } = await makeApiJob();
    await claimOne(destination.id);
    const running = await api().get(`/backup-jobs/${job.id}`).expect(200);
    expect(running.body.status).toBe('running');
    await makeInventoryItem(sourceId, 'C:\\data\\late.txt');
    await db.$client.query(
      "update inventory_items set decision = 'rejected' where source_id = $1 and root_path = 'C:\\data\\a.txt'",
      [sourceId],
    );

    const items = await api().get(`/backup-jobs/${job.id}/items`).expect(200);

    expect(
      items.body.items.map((i: { rootPath: string }) => i.rootPath),
    ).toEqual(['C:\\data\\a.txt', 'C:\\data\\b.txt']);
    expect(
      items.body.items.map((i: { status: string }) => i.status).sort(),
    ).toEqual(['in_progress', 'queued']);
    expect('claimToken' in items.body.items[0]).toBe(false);
  });

  it('lists and fetches jobs with derived progress', async () => {
    const { sourceId, job } = await makeApiJob();

    const one = await api().get(`/backup-jobs/${job.id}`).expect(200);
    expect(one.body.progress.itemCounts.queued).toBe(2);
    expect(one.body.progress.entryCounts.verified).toBe(0);
    expect(one.body.stalledReason).toBeNull();

    const list = await api()
      .get(`/backup-jobs?sourceId=${sourceId}`)
      .expect(200);
    expect(list.body.map((j: { id: string }) => j.id)).toEqual([job.id]);
    await api().get(`/backup-jobs/${crypto.randomUUID()}`).expect(404);
  });

  it('cancels once, audited once; a second cancel is 409 with no event', async () => {
    const { destination, job } = await makeApiJob();
    const { item } = await claimOne(destination.id);

    const res = await api().post(`/backup-jobs/${job.id}/cancel`).expect(200);
    expect(res.body.status).toBe('cancelled');
    expect(res.body.progress.itemCounts.in_progress).toBe(0);
    expect(res.body.progress.itemCounts.queued).toBe(2);
    expect(item.id).toBeDefined();

    await api().post(`/backup-jobs/${job.id}/cancel`).expect(409);
    await api()
      .post(`/backup-jobs/${job.id}/fail`)
      .send({ error: 'late' })
      .expect(409);
    expect(
      await auditCount('backup_job.cancelled', { backupJobId: job.id }),
    ).toBe(1);
    expect(await auditCount('backup_job.failed', { backupJobId: job.id })).toBe(
      0,
    );
  });

  it('fails a job with a reason', async () => {
    const { job } = await makeApiJob();

    const res = await api()
      .post(`/backup-jobs/${job.id}/fail`)
      .send({ error: 'machine retired' })
      .expect(200);

    expect(res.body).toMatchObject({
      status: 'failed',
      error: 'machine retired',
    });
    expect(await auditCount('backup_job.failed', { backupJobId: job.id })).toBe(
      1,
    );
  });

  it('retries a blocked item once, only while the job is active', async () => {
    const { destination, job } = await makeApiJob();
    const { item, claimToken } = await claimOne(destination.id);
    await failBackupItem(db, item.id, {
      claimToken,
      error: 'source_missing',
      kind: 'permanent',
    });

    const single = await api()
      .post(`/backup-job-items/${item.id}/retry`)
      .expect(200);
    // One attempt was spent; the retry grants exactly one more.
    expect(single.body).toMatchObject({
      status: 'queued',
      attemptCount: 1,
      maxAttempts: 2,
    });
    expect('claimToken' in single.body).toBe(false);
    await api().post(`/backup-job-items/${item.id}/retry`).expect(409);

    const second = await claimOne(destination.id);
    await failBackupItem(db, second.item.id, {
      claimToken: second.claimToken,
      error: 'source_missing',
      kind: 'permanent',
    });
    const all = await api()
      .post(`/backup-jobs/${job.id}/retry-failed`)
      .expect(200);
    expect(all.body.retried).toBe(1);

    const retried = () =>
      auditCount('backup_job_item.retried', { backupJobId: job.id });
    expect(await retried()).toBe(2);

    await api().post(`/backup-jobs/${job.id}/cancel`).expect(200);
    await api().post(`/backup-jobs/${job.id}/retry-failed`).expect(409);
    expect(await retried()).toBe(2);
  });

  it('reruns the unresolved items of a finished job as a new job', async () => {
    const sourceId = await makeSource();
    const destination = await makeDestination();
    const ok = await makeInventoryItem(sourceId, 'C:\\data\\ok.txt');
    const bad = await makeInventoryItem(sourceId, 'C:\\data\\bad.txt');
    const first = (
      await create(sourceId, { destinationId: destination.id }).expect(201)
    ).body;

    await api().post(`/backup-jobs/${first.id}/rerun-unresolved`).expect(409);

    let blockedInventoryItemId: string | null = null;
    for (const outcome of ['verify', 'block']) {
      const { item, claimToken } = await claimOne(destination.id);
      if (outcome === 'verify') {
        await markBackupEnumerationComplete(db, item.id, { claimToken });
        await completeBackupItem(db, item.id, { claimToken });
      } else {
        blockedInventoryItemId = item.inventoryItemId;
        await failBackupItem(db, item.id, {
          claimToken,
          error: 'source_missing',
          kind: 'permanent',
        });
      }
    }
    await completeBackupJobIfDone(db, first.id, WORKER);
    const finished = await api().get(`/backup-jobs/${first.id}`).expect(200);
    expect(finished.body.status).toBe('completed_with_issues');

    await api()
      .post(`/sources/${sourceId}/backup-jobs/plan`)
      .send({
        destinationId: destination.id,
        fromJobId: '00000000-0000-4000-8000-000000000000',
      })
      .expect(404);

    const rerun = await api()
      .post(`/backup-jobs/${first.id}/rerun-unresolved`)
      .expect(201);
    expect(rerun.body.status).toBe('planned');
    expect(rerun.body.selection).toMatchObject({ fromJobId: first.id });
    expect(rerun.body.selection.inventoryItemIds).toBeUndefined();
    const listed = await api().get(`/backup-jobs/${rerun.body.id}`).expect(200);
    expect(listed.body.scope).toEqual({ type: 'rerun', fromJobId: first.id });

    const items = await api()
      .get(`/backup-jobs/${rerun.body.id}/items`)
      .expect(200);
    const queued = items.body.items.filter(
      (i: { status: string }) => i.status === 'queued',
    );
    expect(queued).toHaveLength(1);
    expect([ok.id, bad.id]).toContain(queued[0].inventoryItemId);
    expect(queued[0].inventoryItemId).toBe(blockedInventoryItemId);
  });

  it('serves entries with their captured metadata and the item with entry counts', async () => {
    const { destination, job } = await makeApiJob();
    const { item, claimToken } = await claimOne(destination.id);
    const modified = new Date('2019-01-02T03:04:05Z');
    await upsertBackupEntries(db, item.id, {
      claimToken,
      entries: [
        {
          relPath: '',
          normalizedRelPath: '',
          entryType: 'file',
          sizeBytes: 12,
          srcModifiedAt: modified,
          srcZoneIdentifier: '[ZoneTransfer]\nZoneId=3',
        },
      ],
    });

    const detail = await api().get(`/backup-job-items/${item.id}`).expect(200);
    expect(detail.body.entryCounts).toMatchObject({ pending: 1, verified: 0 });
    expect(detail.body.status).toBe('in_progress');
    expect('claimToken' in detail.body).toBe(false);

    const entries = await api()
      .get(`/backup-job-items/${item.id}/entries?status=pending`)
      .expect(200);
    expect(entries.body.next).toBeNull();
    expect(entries.body.entries).toHaveLength(1);
    expect(entries.body.entries[0]).toMatchObject({
      status: 'pending',
      srcModifiedAt: modified.toISOString(),
      srcZoneIdentifier: '[ZoneTransfer]\nZoneId=3',
    });
    const none = await api()
      .get(`/backup-job-items/${item.id}/entries?status=verified`)
      .expect(200);
    expect(none.body.entries).toEqual([]);
    expect(job.id).toBeDefined();
    await api()
      .get(`/backup-job-items/${crypto.randomUUID()}/entries`)
      .expect(404);
  });
});

describe('coverage', () => {
  it('states scope and limits, hides rejected items and is not all-accounted until nothing blocks', async () => {
    const sourceId = await makeSource();
    const destination = await makeDestination();
    await makeInventoryItem(sourceId, 'C:\\data\\a.txt');
    await makeInventoryItem(sourceId, 'C:\\data\\gone.txt', {
      decision: 'rejected',
    });
    const url = `/sources/${sourceId}/backup-coverage?destinationId=${destination.id}`;

    const before = await api().get(url).expect(200);
    expect(before.body).toMatchObject({
      allAccounted: false,
      total: 2,
      omittedRejected: 1,
      counts: { never_attempted: 1, rejected: 1, covered: 0 },
    });
    expect(before.body.scope).toMatch(/inventory items/i);
    expect(before.body.limits).toHaveLength(5);
    expect(before.body.items.map((i: { bucket: string }) => i.bucket)).toEqual([
      'never_attempted',
    ]);
    expect(before.body.discoveryReview).toMatchObject({ jobs: [] });

    const rejected = await api().get(`${url}&bucket=rejected`).expect(200);
    expect(rejected.body.items).toHaveLength(1);
    expect(rejected.body.omittedRejected).toBe(0);

    const job = (await create(sourceId, { destinationId: destination.id }))
      .body;
    await verifyAll(destination.id, job.id);

    const after = await api().get(url).expect(200);
    expect(after.body).toMatchObject({
      allAccounted: true,
      counts: { covered: 1, rejected: 1 },
    });
  });

  it('counts a pending decision as blocking and shows discovery review beside it', async () => {
    const sourceId = await makeSource();
    const destination = await makeDestination();
    await makeInventoryItem(sourceId, 'C:\\data\\p.txt', {
      decision: 'pending',
    });
    const coverage = async () =>
      (
        await api()
          .get(
            `/sources/${sourceId}/backup-coverage?destinationId=${destination.id}`,
          )
          .expect(200)
      ).body;
    const discover = async () => {
      const job = await api()
        .post(`/sources/${sourceId}/discovery-jobs`)
        .send({ rootPath: 'C:\\data' })
        .expect(201);

      return job.body.id as string;
    };

    // An unfinished discovery job is not counted.
    const first = await discover();
    const running = await coverage();
    expect(running.allAccounted).toBe(false);
    expect(running.counts.undecided).toBe(1);
    expect(running.discoveryReview.jobs).toEqual([]);

    // Completed jobs are, each directory once however many jobs visited it.
    await db.$client.query(
      "update discovery_jobs set status = 'completed', finished_at = now() where id = $1",
      [first],
    );
    const second = await discover();
    await db.$client.query(
      "update discovery_jobs set status = 'completed', finished_at = now() where id = $1",
      [second],
    );

    const done = await coverage();
    expect(done.discoveryReview.jobs.map((j: { id: string }) => j.id)).toEqual([
      second,
      first,
    ]);
    expect(done.discoveryReview.directories).toEqual({
      reviewed: 0,
      notReviewed: 0,
      unknown: 0,
      notExplored: 1,
    });
    expect(done.discoveryReview.truncated).toBe(false);
    expect(done.allAccounted).toBe(false);
  });

  it('downloads the full report as a file, including rejected items', async () => {
    const sourceId = await makeSource();
    const destination = await makeDestination();
    await makeInventoryItem(sourceId, 'C:\\data\\a.txt');
    await makeInventoryItem(sourceId, 'C:\\data\\gone.txt', {
      decision: 'rejected',
    });

    const res = await api()
      .get(
        `/sources/${sourceId}/backup-coverage?destinationId=${destination.id}&format=json&bucket=covered`,
      )
      .expect(200);

    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="backup-coverage-backup-test-.*\.json"$/,
    );
    const report = JSON.parse(res.text);
    expect(report.items).toHaveLength(2);
    expect(report.omittedRejected).toBe(0);
    expect(report.limits).toHaveLength(5);
  });

  it('answers 404 for an unknown source or destination', async () => {
    const destination = await makeDestination();
    const sourceId = await makeSource();

    await api()
      .get(
        `/sources/${crypto.randomUUID()}/backup-coverage?destinationId=${destination.id}`,
      )
      .expect(404);
    await api()
      .get(
        `/sources/${sourceId}/backup-coverage?destinationId=${crypto.randomUUID()}`,
      )
      .expect(404);
  });
});
