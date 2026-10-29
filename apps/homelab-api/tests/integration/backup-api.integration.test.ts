import {
  claimNextBackupItem,
  completeBackupItem,
  completeBackupJobIfDone,
  createSource,
  failBackupItem,
  markBackupEnumerationComplete,
  recordBackupDestinationValidation,
  upsertBackupEntries,
} from '@abbottland/homelab-db';
import { db } from '../../src/db';
import { getRequest } from '../jest.integration.setup';
import {
  WORKER,
  auditCount,
  cleanupBackupFixtures,
  makeDestination,
  makeHost,
  makeInventoryItem,
  makeSource,
} from './fixtures/backup';

// Runs against the real local dev Postgres. Fixtures clean up sources and
// destinations; destinations made through the API are tracked here.
const apiDestinationIds: string[] = [];

afterEach(async () => {
  await cleanupBackupFixtures();
  await db.$client.query(
    'delete from audit_events where destination_id = any($1)',
    [apiDestinationIds],
  );
  await db.$client.query('delete from backup_destinations where id = any($1)', [
    apiDestinationIds,
  ]);
  apiDestinationIds.length = 0;
});

const api = () => getRequest();

type PlanBody = { destinationId: string } & Record<string, unknown>;

const plan = (sourceId: string, body: PlanBody) =>
  api().post(`/sources/${sourceId}/backup-jobs/plan`).send(body);

const create = (sourceId: string, body: PlanBody) =>
  api().post(`/sources/${sourceId}/backup-jobs`).send(body);

const jobCount = async (sourceId: string): Promise<number> =>
  (
    await db.$client.query(
      'select count(*)::int as n from backup_jobs where source_id = $1',
      [sourceId],
    )
  ).rows[0].n;

const claimOne = async (destinationId: string) => {
  const result = await claimNextBackupItem(db, {
    destinationId,
    workerId: WORKER.id,
    leaseSeconds: 300,
  });
  if (!('job' in result)) throw new Error(`nothing to claim: ${result.reason}`);

  return { item: result.item, claimToken: result.item.claimToken as string };
};

/** Claims every queued item and verifies it, then runs the completion check. */
const verifyAll = async (destinationId: string, jobId: string) => {
  for (;;) {
    const result = await claimNextBackupItem(db, {
      destinationId,
      workerId: WORKER.id,
      leaseSeconds: 300,
    });
    if (!('job' in result)) break;
    const claimToken = result.item.claimToken as string;
    await markBackupEnumerationComplete(db, result.item.id, { claimToken });
    await completeBackupItem(db, result.item.id, { claimToken });
  }
  await completeBackupJobIfDone(db, jobId, WORKER);
};

describe('destinations', () => {
  let hostId: string;
  beforeAll(async () => {
    hostId = await makeHost();
  });

  const body = () => ({
    name: `api-dest-${Math.random().toString(36).slice(2)}`,
    hostId,
    settings: { exportPath: '/volume1/Test' },
  });

  it('creates one, audits once, and a duplicate name is 409 with no event', async () => {
    const payload = body();
    const res = await api()
      .post('/backup-destinations')
      .send(payload)
      .expect(201);
    apiDestinationIds.push(res.body.id);

    expect(res.body).toMatchObject({
      name: payload.name,
      connectionType: 'nfs',
      enabled: true,
      health: 'unknown',
      rootDir: null,
      workerStale: true,
      hostId,
      host: { id: hostId, ipAddress: '192.0.2.10' },
    });
    expect(
      await auditCount('backup_destination.created', {
        destinationId: res.body.id,
      }),
    ).toBe(1);

    await api().post('/backup-destinations').send(payload).expect(409);
    expect(
      await auditCount('backup_destination.created', {
        destinationId: res.body.id,
      }),
    ).toBe(1);
  });

  it('answers 404 for a host that does not exist', async () => {
    await api()
      .post('/backup-destinations')
      .send({ ...body(), hostId: crypto.randomUUID() })
      .expect(404);
  });

  it('refuses a non-human actor without writing', async () => {
    const payload = body();
    await api()
      .post('/backup-destinations')
      .set('x-actor-type', 'openclaw')
      .send(payload)
      .expect(403);

    const list = await api().get('/backup-destinations').expect(200);
    expect(
      list.body.some((d: { name: string }) => d.name === payload.name),
    ).toBe(false);
  });

  it('validate only records the request: 202, no audit event', async () => {
    const destination = await makeDestination();

    const res = await api()
      .post(`/backup-destinations/${destination.id}/validate`)
      .expect(202);

    expect(res.body.validationRequestedAt).not.toBeNull();
    expect(res.body.health).toBe('unknown');
    expect(res.body.lastValidation).toBeNull();
    await api()
      .post(`/backup-destinations/${crypto.randomUUID()}/validate`)
      .expect(404);
  });

  it('reports a worker that polled recently as not stale', async () => {
    const destination = await makeDestination();
    await recordBackupDestinationValidation(db, destination.id, {
      workerId: WORKER.id,
      validation: { ok: true },
    });

    const res = await api()
      .get(`/backup-destinations/${destination.id}`)
      .expect(200);
    expect(res.body).toMatchObject({ workerStale: false, health: 'ok' });
  });

  it('audits enable and disable only when they change something', async () => {
    const destination = await makeDestination();
    const events = (type: string) =>
      auditCount(type, { destinationId: destination.id });

    await api()
      .post(`/backup-destinations/${destination.id}/disable`)
      .expect(200);
    await api()
      .post(`/backup-destinations/${destination.id}/disable`)
      .expect(200);
    expect(await events('backup_destination.disabled')).toBe(1);

    await api()
      .post(`/backup-destinations/${destination.id}/enable`)
      .expect(200);
    await api()
      .post(`/backup-destinations/${destination.id}/enable`)
      .expect(200);
    expect(await events('backup_destination.enabled')).toBe(1);
  });

  it('locks identity fields once a job exists but still allows a rename', async () => {
    const destination = await makeDestination();
    const sourceId = await makeSource();
    await makeInventoryItem(sourceId, 'C:\\data\\a.txt');
    await create(sourceId, { destinationId: destination.id }).expect(201);
    const updated = () =>
      auditCount('backup_destination.updated', {
        destinationId: destination.id,
      });

    await api()
      .patch(`/backup-destinations/${destination.id}`)
      .send({ settings: { exportPath: '/volume1/Other' } })
      .expect(409);
    await api()
      .patch(`/backup-destinations/${destination.id}`)
      .send({ hostId: await makeHost() })
      .expect(409);
    await api()
      .patch(`/backup-destinations/${destination.id}`)
      .send({ rootDir: 'sub' })
      .expect(409);
    expect(await updated()).toBe(0);

    const renamed = `${destination.name}-renamed`;
    const res = await api()
      .patch(`/backup-destinations/${destination.id}`)
      .send({ name: renamed })
      .expect(200);
    expect(res.body.name).toBe(renamed);
    expect(await updated()).toBe(1);
  });
});

describe('planning', () => {
  /** Approved file and directory with a nested file and a rejected child, plus the other decisions. */
  const seed = async () => {
    const sourceId = await makeSource();
    const destination = await makeDestination();
    const file = await makeInventoryItem(sourceId, 'C:\\data\\a.txt');
    const dir = await makeInventoryItem(sourceId, 'C:\\data\\dir', {
      kind: 'directory',
    });
    const nested = await makeInventoryItem(sourceId, 'C:\\data\\dir\\n.txt');
    const rejectedChild = await makeInventoryItem(
      sourceId,
      'C:\\data\\dir\\skip',
      { kind: 'directory', decision: 'rejected' },
    );
    const pending = await makeInventoryItem(sourceId, 'C:\\data\\p.txt', {
      decision: 'pending',
    });
    const rejected = await makeInventoryItem(sourceId, 'C:\\data\\f.txt', {
      decision: 'rejected',
    });
    const excluded = await makeInventoryItem(sourceId, 'C:\\cache\\x', {
      kind: 'directory',
    });
    await api()
      .post('/exclusion-rules')
      .send({ sourceId, path: 'C:\\cache', scope: 'exclude_subtree' })
      .expect(201);

    return {
      sourceId,
      destination,
      file,
      dir,
      nested,
      rejectedChild,
      pending,
      rejected,
      excluded,
    };
  };

  it('plans every case and writes nothing', async () => {
    const s = await seed();

    const res = await plan(s.sourceId, {
      destinationId: s.destination.id,
    }).expect(200);

    expect(res.body.summary).toMatchObject({
      toCopy: 2,
      skippedRedundantNested: 1,
      skippedAlreadyCovered: 0,
      excluded: 1,
      notEligible: 3,
      unestimatedItems: 2,
    });
    const byPath = Object.fromEntries(
      res.body.items.map((i: { rootPath: string }) => [i.rootPath, i]),
    );
    expect(byPath['C:\\data\\a.txt']).toMatchObject({
      status: 'queued',
      destRelPath: 'C/data/a.txt',
    });
    expect(byPath['C:\\data\\dir']).toMatchObject({
      status: 'queued',
      carveOuts: [
        {
          path: 'C:\\data\\dir\\skip',
          reason: 'rejected_item',
          refId: s.rejectedChild.id,
        },
      ],
    });
    expect(byPath['C:\\data\\dir\\n.txt']).toMatchObject({
      status: 'skipped',
      statusReason: 'redundant_nested',
      coveredByInventoryItemId: s.dir.id,
    });
    expect(byPath['C:\\cache\\x']).toMatchObject({
      status: 'excluded',
      statusReason: 'excluded_by_rule',
    });
    expect(
      res.body.notEligible.map((n: { decision: string }) => n.decision).sort(),
    ).toEqual(['pending', 'rejected', 'rejected']);
    expect(res.body.sourceDirName).toMatch(/^backup-test-/);
    expect(await jobCount(s.sourceId)).toBe(0);
  });

  it('applies a selection', async () => {
    const s = await seed();

    const res = await plan(s.sourceId, {
      destinationId: s.destination.id,
      inventoryItemIds: [s.file.id],
    }).expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.selection.inventoryItemIds).toEqual([s.file.id]);
  });

  it('rejects an empty selection and one with nothing approved', async () => {
    const s = await seed();

    const none = await plan(s.sourceId, {
      destinationId: s.destination.id,
      pathPrefix: 'D:\\nothing',
    }).expect(409);
    expect(none.body.message).toMatch(/matches no inventory items/);

    const notApproved = await plan(s.sourceId, {
      destinationId: s.destination.id,
      inventoryItemIds: [s.pending.id, s.rejected.id],
    }).expect(409);
    expect(notApproved.body.notEligible).toHaveLength(2);
    expect(await jobCount(s.sourceId)).toBe(0);
  });

  it('refuses a second active job, a disabled destination and unknown ids', async () => {
    const s = await seed();
    const first = await create(s.sourceId, {
      destinationId: s.destination.id,
    }).expect(201);

    const again = await create(s.sourceId, {
      destinationId: s.destination.id,
    }).expect(409);
    expect(again.body.jobId).toBe(first.body.id);
    await plan(s.sourceId, { destinationId: s.destination.id }).expect(409);
    expect(await jobCount(s.sourceId)).toBe(1);

    const other = await makeDestination({ enabled: false });
    await plan(s.sourceId, { destinationId: other.id }).expect(409);
    await create(s.sourceId, { destinationId: other.id }).expect(409);

    await plan(crypto.randomUUID(), { destinationId: s.destination.id }).expect(
      404,
    );
    await plan(s.sourceId, { destinationId: crypto.randomUUID() }).expect(404);
  });

  it('warns about a running discovery job', async () => {
    const s = await seed();
    const before = await plan(s.sourceId, {
      destinationId: s.destination.id,
    }).expect(200);
    expect(
      before.body.warnings.map((w: { code: string }) => w.code),
    ).not.toContain('discovery_job_active');

    await api()
      .post(`/sources/${s.sourceId}/discovery-jobs`)
      .send({ rootPath: 'C:\\data' })
      .expect(201);

    const after = await plan(s.sourceId, {
      destinationId: s.destination.id,
    }).expect(200);
    expect(after.body.warnings.map((w: { code: string }) => w.code)).toContain(
      'discovery_job_active',
    );
  });

  it('warns about the source folder from what the destination reported', async () => {
    const s = await seed();
    const codes = async () =>
      (
        await plan(s.sourceId, { destinationId: s.destination.id }).expect(200)
      ).body.warnings.map((w: { code: string }) => w.code);
    const dirName = (
      await plan(s.sourceId, { destinationId: s.destination.id })
    ).body.sourceDirName;

    expect(await codes()).toContain('destination_folder_unknown');

    await recordBackupDestinationValidation(db, s.destination.id, {
      workerId: WORKER.id,
      validation: { ok: true, rootEntries: ['unrelated', dirName] },
    });
    expect(await codes()).toContain('destination_folder_exists');

    await recordBackupDestinationValidation(db, s.destination.id, {
      workerId: WORKER.id,
      validation: { ok: true, rootEntries: ['unrelated'] },
    });
    expect(await codes()).toEqual([]);
  });

  it('refuses a folder name another source already uses at the destination', async () => {
    const s = await seed();
    const first = await create(s.sourceId, {
      destinationId: s.destination.id,
    }).expect(201);
    const folder = first.body.sourceDirName;
    const sourceRow = await db.$client.query(
      'select name from sources where id = $1',
      [s.sourceId],
    );

    const twin = await createSource(db, {
      name: sourceRow.rows[0].name.toUpperCase(),
    });
    try {
      await makeInventoryItem(twin.id, 'C:\\data\\a.txt');
      const res = await plan(twin.id, {
        destinationId: s.destination.id,
      }).expect(409);
      expect(res.body.message).toContain(`"${folder}"`);
    } finally {
      await db.$client.query('delete from sources where id = $1', [twin.id]);
    }
  });

  it('skips verified items and reuses their destination path on the next job', async () => {
    const s = await seed();
    const first = await create(s.sourceId, {
      destinationId: s.destination.id,
    }).expect(201);
    await verifyAll(s.destination.id, first.body.id);

    const res = await plan(s.sourceId, {
      destinationId: s.destination.id,
    }).expect(200);
    const status = (path: string) =>
      res.body.items.find((i: { rootPath: string }) => i.rootPath === path);
    expect(status('C:\\data\\a.txt')).toMatchObject({
      status: 'skipped',
      statusReason: 'already_covered',
    });
    expect(status('C:\\data\\dir')).toMatchObject({
      status: 'skipped',
      statusReason: 'already_covered',
    });
    expect(res.body.sourceDirName).toBe(first.body.sourceDirName);

    const forced = await plan(s.sourceId, {
      destinationId: s.destination.id,
      skipAlreadyCovered: false,
    }).expect(200);
    expect(forced.body.summary.skippedAlreadyCovered).toBe(0);
    expect(forced.body.summary.toCopy).toBeGreaterThanOrEqual(2);
  });
});

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

    const rerun = await api()
      .post(`/backup-jobs/${first.id}/rerun-unresolved`)
      .expect(201);
    expect(rerun.body.status).toBe('planned');
    expect(rerun.body.selection.inventoryItemIds).toHaveLength(1);

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
