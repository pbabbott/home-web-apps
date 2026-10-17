import { db } from '../../src/db';
import { getRequest } from '../jest.integration.setup';

// Runs against the real local dev Postgres, so every source and host created
// here is deleted afterwards. Sources go first (hosts are ON DELETE RESTRICT);
// jobs and queue items go with their source via ON DELETE CASCADE.
const createdSourceIds: string[] = [];
const createdHostIds: string[] = [];

afterEach(async () => {
  await db.$client.query('delete from backup_sources where id = any($1)', [
    createdSourceIds,
  ]);
  await db.$client.query('delete from hosts where id = any($1)', [
    createdHostIds,
  ]);
  createdSourceIds.length = 0;
  createdHostIds.length = 0;
});

const createHost = async (): Promise<string> => {
  const res = await getRequest()
    .post('/hosts')
    .send({
      name: `exodus-test-host-${Math.random().toString(36).slice(2)}`,
      ipAddress: '192.0.2.1',
    })
    .expect(201);
  createdHostIds.push(res.body.id);

  return res.body.id;
};

const ROOT = 'C:\\Users\\You';

type Item = {
  id: string;
  path: string;
  normalizedPath: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  lastError: string | null;
  claimToken: string | null;
  availableAt: string;
};

const createSource = async (): Promise<string> => {
  const res = await getRequest()
    .post('/backup-sources')
    .send({
      name: `exodus-test-${Math.random().toString(36).slice(2)}`,
      hostId: await createHost(),
    })
    .expect(201);
  createdSourceIds.push(res.body.id);

  return res.body.id;
};

const startJob = async (sourceId: string, rootPath = ROOT) => {
  const res = await getRequest()
    .post(`/backup-sources/${sourceId}/discovery-jobs`)
    .send({ rootPath })
    .expect(201);

  return res.body as { id: string; status: string };
};

const claim = (jobId: string, workerId = 'worker-a', leaseSeconds = 300) =>
  getRequest()
    .post(`/discovery-jobs/${jobId}/queue-items/claim`)
    .send({ workerId, leaseSeconds });

const claimOk = async (jobId: string, workerId?: string): Promise<Item> => {
  const res = await claim(jobId, workerId).expect(200);

  return res.body;
};

const complete = (item: Item, discoveredPaths: string[] = []) =>
  getRequest()
    .post(`/queue-items/${item.id}/complete`)
    .send({ claimToken: item.claimToken, discoveredPaths });

const fail = (item: Item, error = 'boom', retryable = true) =>
  getRequest()
    .post(`/queue-items/${item.id}/fail`)
    .send({ claimToken: item.claimToken, error, retryable });

const getJob = async (jobId: string) =>
  (await getRequest().get(`/discovery-jobs/${jobId}`).expect(200)).body;

const listItems = async (sourceId: string, query: object = {}) =>
  (
    await getRequest()
      .get(`/backup-sources/${sourceId}/queue-items`)
      .query(query)
      .expect(200)
  ).body as Item[];

const expireLease = (itemId: string) =>
  db.$client.query(
    "update discovery_queue_items set lease_expires_at = now() - interval '1 minute' where id = $1",
    [itemId],
  );

const skipBackoff = (itemId: string) =>
  db.$client.query(
    "update discovery_queue_items set available_at = now() - interval '1 second' where id = $1",
    [itemId],
  );

describe('backup sources', () => {
  it('creates and lists sources', async () => {
    const id = await createSource();

    const res = await getRequest().get('/backup-sources').expect(200);

    expect(res.body.map((s: { id: string }) => s.id)).toContain(id);
  });

  it('rejects a duplicate name', async () => {
    const hostId = await createHost();
    const res = await getRequest()
      .post('/backup-sources')
      .send({ name: 'exodus-test-dupe', hostId })
      .expect(201);
    createdSourceIds.push(res.body.id);

    await getRequest()
      .post('/backup-sources')
      .send({ name: 'exodus-test-dupe', hostId })
      .expect(409);
  });

  it('creates a source without a host', async () => {
    const res = await getRequest()
      .post('/backup-sources')
      .send({ name: 'exodus-test-nohostid' })
      .expect(201);
    createdSourceIds.push(res.body.id);

    expect(res.body.hostId).toBeNull();
  });

  it('rejects a host that does not exist', async () => {
    const res = await getRequest()
      .post('/backup-sources')
      .send({
        name: 'exodus-test-nohost',
        hostId: '123e4567-e89b-12d3-a456-426614174000',
      })
      .expect(404);

    expect(res.body.message).toBe('host not found');
  });

  it('is joinable to hosts', async () => {
    const hostId = await createHost();
    const res = await getRequest()
      .post('/backup-sources')
      .send({ name: 'exodus-test-join', hostId })
      .expect(201);
    createdSourceIds.push(res.body.id);

    const { rows } = await db.$client.query(
      'select h.id, h.ip_address from backup_sources s join hosts h on h.id = s.host_id where s.id = $1',
      [res.body.id],
    );

    expect(rows).toEqual([{ id: hostId, ip_address: '192.0.2.1' }]);
  });

  it('blocks deleting a host that still has a source', async () => {
    const hostId = await createHost();
    const res = await getRequest()
      .post('/backup-sources')
      .send({ name: 'exodus-test-inuse', hostId })
      .expect(201);
    createdSourceIds.push(res.body.id);

    await getRequest().delete(`/hosts/${hostId}`).expect(409);
  });
});

describe('Example 1: start a discovery job', () => {
  it('creates a pending job, queues the root, and runs on first claim', async () => {
    const sourceId = await createSource();

    const job = await startJob(sourceId, 'c:/Users/You/');
    expect(job.status).toBe('pending');
    expect(await getJob(job.id)).toMatchObject({
      queueCounts: { queued: 1, in_progress: 0 },
    });

    const [root] = await listItems(sourceId);
    expect(root).toMatchObject({
      path: 'C:\\Users\\You',
      normalizedPath: 'c:\\users\\you',
      status: 'queued',
    });

    await claimOk(job.id);

    expect((await getJob(job.id)).status).toBe('running');
  });

  it('lists a source’s jobs newest first', async () => {
    const sourceId = await createSource();
    const first = await startJob(sourceId);
    await getRequest().post(`/discovery-jobs/${first.id}/cancel`).expect(200);
    const second = await startJob(sourceId, 'D:\\Data');

    const res = await getRequest()
      .get(`/backup-sources/${sourceId}/discovery-jobs`)
      .expect(200);

    expect(res.body.map((j: { id: string }) => j.id)).toEqual([
      second.id,
      first.id,
    ]);
    await getRequest()
      .get(
        '/backup-sources/123e4567-e89b-12d3-a456-426614174000/discovery-jobs',
      )
      .expect(404);
  });

  it('allows only one active job per source', async () => {
    const sourceId = await createSource();
    await startJob(sourceId);

    await getRequest()
      .post(`/backup-sources/${sourceId}/discovery-jobs`)
      .send({ rootPath: 'D:\\Data' })
      .expect(409);
  });

  it('allows a new job once the previous one is cancelled', async () => {
    const sourceId = await createSource();
    const first = await startJob(sourceId);

    await getRequest().post(`/discovery-jobs/${first.id}/cancel`).expect(200);

    expect((await startJob(sourceId)).status).toBe('pending');
  });

  it('404s for an unknown source and rejects invalid roots', async () => {
    await getRequest()
      .post(
        '/backup-sources/123e4567-e89b-12d3-a456-426614174000/discovery-jobs',
      )
      .send({ rootPath: ROOT })
      .expect(404);

    const sourceId = await createSource();
    await getRequest()
      .post(`/backup-sources/${sourceId}/discovery-jobs`)
      .send({ rootPath: 'relative\\path' })
      .expect(400);
  });
});

describe('Example 2: explore incrementally', () => {
  it('completes a directory and enqueues its children atomically', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const rootItem = await claimOk(job.id);

    const res = await complete(rootItem, [
      `${ROOT}\\Documents`,
      `${ROOT}\\Pictures`,
      `${ROOT}\\Projects`,
    ]).expect(200);

    expect(res.body.status).toBe('completed');
    expect(res.body.children).toHaveLength(3);
    expect(await getJob(job.id)).toMatchObject({
      queueCounts: { queued: 3, completed: 1 },
    });

    // A "fresh session" only needs the job id to pick up where the last left off.
    const next = await claimOk(job.id, 'worker-b');
    expect(next.path.startsWith(`${ROOT}\\`)).toBe(true);
    expect(next.claimToken).toBeTruthy();
  });

  it('does not enqueue the children if the completion is rejected', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const rootItem = await claimOk(job.id);

    await getRequest()
      .post(`/queue-items/${rootItem.id}/complete`)
      .send({
        claimToken: '123e4567-e89b-12d3-a456-426614174000',
        discoveredPaths: [`${ROOT}\\Documents`],
      })
      .expect(409);

    expect((await getJob(job.id)).queueCounts).toMatchObject({
      queued: 0,
      in_progress: 1,
    });
  });

  it('rejects children outside the job root before completing anything', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const rootItem = await claimOk(job.id);

    await complete(rootItem, ['D:\\Elsewhere']).expect(409);

    expect((await listItems(sourceId))[0].status).toBe('in_progress');
  });

  it('dedupes enqueues case-insensitively and across slash styles', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);

    const first = await getRequest()
      .post(`/discovery-jobs/${job.id}/queue-items`)
      .send({ paths: [`${ROOT}\\Documents`] })
      .expect(200);
    expect(first.body[0].created).toBe(true);

    const second = await getRequest()
      .post(`/discovery-jobs/${job.id}/queue-items`)
      .send({ paths: ['c:/users/YOU/documents/', `${ROOT}\\Pictures`] })
      .expect(200);

    expect(second.body.map((i: { created: boolean }) => i.created)).toEqual([
      false,
      true,
    ]);
    expect(second.body[0].id).toBe(first.body[0].id);
    expect(await listItems(sourceId)).toHaveLength(3);
  });

  it('respects directory boundaries when checking the job root', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);

    await getRequest()
      .post(`/discovery-jobs/${job.id}/queue-items`)
      .send({ paths: ['C:\\Users\\YouOther\\Documents'] })
      .expect(409);
  });

  it('claims higher priority first', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    await complete(await claimOk(job.id));

    await getRequest()
      .post(`/discovery-jobs/${job.id}/queue-items`)
      .send({ paths: [`${ROOT}\\Low`] })
      .expect(200);
    await getRequest()
      .post(`/discovery-jobs/${job.id}/queue-items`)
      .send({ paths: [`${ROOT}\\High`], priority: 10 })
      .expect(200);

    expect((await claimOk(job.id)).path).toBe(`${ROOT}\\High`);
  });

  it('skips a claimed directory', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const item = await claimOk(job.id);

    const res = await getRequest()
      .post(`/queue-items/${item.id}/skip`)
      .send({ claimToken: item.claimToken, reason: 'system directory' })
      .expect(200);

    expect(res.body).toMatchObject({
      status: 'skipped',
      lastError: 'skipped: system directory',
    });
  });
});

describe('concurrent claims', () => {
  it('hands a single item to exactly one of ten parallel workers', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);

    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, i) => claim(job.id, `worker-${i}`)),
    );

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 204)).toHaveLength(9);
  });

  it('never hands the same item to two workers when several are queued', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    await complete(await claimOk(job.id), [
      `${ROOT}\\A`,
      `${ROOT}\\B`,
      `${ROOT}\\C`,
    ]);

    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, i) => claim(job.id, `worker-${i}`)),
    );

    const claimedIds = responses
      .filter((r) => r.status === 200)
      .map((r) => r.body.id);
    expect(claimedIds).toHaveLength(3);
    expect(new Set(claimedIds).size).toBe(3);
  });
});

describe('Example 3: recover abandoned work', () => {
  it('reclaims an item after its lease expires and keeps its history', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const abandoned = await claimOk(job.id, 'crashed-worker');

    // Still leased: nobody else can take it.
    await claim(job.id, 'worker-b').expect(204);

    await expireLease(abandoned.id);

    const reclaimed = await claimOk(job.id, 'worker-b');
    expect(reclaimed).toMatchObject({
      id: abandoned.id,
      attemptCount: 2,
      lastError: 'lease expired',
    });
    expect(reclaimed.claimToken).not.toBe(abandoned.claimToken);
  });

  it('rejects the dead claim once the item is reclaimed', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const abandoned = await claimOk(job.id, 'crashed-worker');
    await expireLease(abandoned.id);
    const reclaimed = await claimOk(job.id, 'worker-b');

    await complete(abandoned, [`${ROOT}\\Late`]).expect(409);
    await getRequest()
      .post(`/queue-items/${abandoned.id}/heartbeat`)
      .send({ claimToken: abandoned.claimToken })
      .expect(409);
    await fail(abandoned).expect(409);

    await complete(reclaimed).expect(200);
    expect(await listItems(sourceId, { status: 'completed' })).toHaveLength(1);
  });

  it('rejects completion on an expired lease even if nobody reclaimed it', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const item = await claimOk(job.id);
    await expireLease(item.id);

    await complete(item).expect(409);
  });

  it('extends a live lease with a heartbeat', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const item = await claimOk(job.id);

    await getRequest()
      .post(`/queue-items/${item.id}/heartbeat`)
      .send({ claimToken: item.claimToken, leaseSeconds: 600 })
      .expect(200);

    await complete(item).expect(200);
  });

  it('fails an abandoned item permanently once attempts are exhausted', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const item = await claimOk(job.id);
    await db.$client.query(
      'update discovery_queue_items set max_attempts = 1 where id = $1',
      [item.id],
    );
    await expireLease(item.id);

    await claim(job.id, 'worker-b').expect(204);

    const [failed] = await listItems(sourceId, { status: 'failed' });
    expect(failed).toMatchObject({
      id: item.id,
      attemptCount: 1,
      lastError: 'lease expired',
    });
  });
});

describe('Example 4: retry failures', () => {
  it('requeues a transient failure behind a backoff', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const item = await claimOk(job.id);

    const res = await fail(item, 'EBUSY').expect(200);
    expect(res.body).toMatchObject({
      status: 'queued',
      lastError: 'EBUSY',
      attemptCount: 1,
    });
    expect(new Date(res.body.availableAt).getTime()).toBeGreaterThan(
      Date.now(),
    );

    await claim(job.id, 'worker-b').expect(204);

    await skipBackoff(item.id);
    expect(await claimOk(job.id, 'worker-b')).toMatchObject({
      id: item.id,
      attemptCount: 2,
      lastError: 'EBUSY',
    });
  });

  it('marks a non-retryable failure permanent immediately', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const item = await claimOk(job.id);

    const res = await fail(item, 'access denied', false).expect(200);

    expect(res.body.status).toBe('failed');
    await claim(job.id).expect(204);
  });

  it('stops retrying after max attempts', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);

    for (let attempt = 1; attempt <= 3; attempt++) {
      const item = await claimOk(job.id);
      const res = await fail(item, `try ${attempt}`).expect(200);
      expect(res.body.status).toBe(attempt < 3 ? 'queued' : 'failed');
      await skipBackoff(item.id);
    }

    await claim(job.id).expect(204);
    expect(await listItems(sourceId, { status: 'failed' })).toHaveLength(1);
  });

  it('lets a human retry a failed item for exactly one more attempt', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const item = await claimOk(job.id);
    await fail(item, 'access denied', false).expect(200);

    const retried = await getRequest()
      .post(`/queue-items/${item.id}/retry`)
      .expect(200);
    expect(retried.body).toMatchObject({
      status: 'queued',
      attemptCount: 1,
      maxAttempts: 2,
      lastError: 'access denied',
    });

    const again = await claimOk(job.id);
    expect(again.attemptCount).toBe(2);
    expect((await fail(again, 'still denied').expect(200)).body.status).toBe(
      'failed',
    );
  });

  it('only retries failed items', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const item = await claimOk(job.id);

    await getRequest().post(`/queue-items/${item.id}/retry`).expect(409);
    await getRequest()
      .post('/queue-items/123e4567-e89b-12d3-a456-426614174000/retry')
      .expect(404);
  });
});

describe('Example 5: finish a job', () => {
  it('blocks completion while work is queued or in progress', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);

    const queued = await getRequest()
      .post(`/discovery-jobs/${job.id}/complete`)
      .expect(409);
    expect(queued.body.queueCounts).toMatchObject({ queued: 1 });

    const item = await claimOk(job.id);
    const inProgress = await getRequest()
      .post(`/discovery-jobs/${job.id}/complete`)
      .expect(409);
    expect(inProgress.body.queueCounts).toMatchObject({ in_progress: 1 });

    await complete(item).expect(200);
    await getRequest().post(`/discovery-jobs/${job.id}/complete`).expect(200);
  });

  it('blocks completion while a retry is waiting out its backoff', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    await fail(await claimOk(job.id)).expect(200);

    const res = await getRequest()
      .post(`/discovery-jobs/${job.id}/complete`)
      .expect(409);

    expect(res.body.queueCounts).toMatchObject({ queued: 1, failed: 0 });
  });

  it('reclaims an expired lease before judging completion', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const item = await claimOk(job.id);
    await expireLease(item.id);

    const res = await getRequest()
      .post(`/discovery-jobs/${job.id}/complete`)
      .expect(409);

    // Back in the queue as eligible work, not silently counted as done.
    expect(res.body.queueCounts).toMatchObject({ queued: 1, in_progress: 0 });
  });

  it('completes with failures and reports them in the counts', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const rootItem = await claimOk(job.id);
    await complete(rootItem, [`${ROOT}\\Good`, `${ROOT}\\Bad`]).expect(200);

    for (let i = 0; i < 2; i++) {
      const item = await claimOk(job.id);
      if (item.path.endsWith('Bad'))
        await fail(item, 'denied', false).expect(200);
      else await complete(item).expect(200);
    }

    const res = await getRequest()
      .post(`/discovery-jobs/${job.id}/complete`)
      .expect(200);

    expect(res.body.status).toBe('completed');
    expect(res.body.queueCounts).toMatchObject({ completed: 2, failed: 1 });
    expect(res.body.finishedAt).toBeTruthy();
    expect(await listItems(sourceId, { status: 'failed' })).toHaveLength(1);
  });

  it('rejects further changes once a job is finished', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    await complete(await claimOk(job.id)).expect(200);
    await getRequest().post(`/discovery-jobs/${job.id}/complete`).expect(200);

    await getRequest().post(`/discovery-jobs/${job.id}/complete`).expect(409);
    await getRequest().post(`/discovery-jobs/${job.id}/cancel`).expect(409);
    await getRequest()
      .post(`/discovery-jobs/${job.id}/fail`)
      .send({ error: 'late' })
      .expect(409);
    await claim(job.id).expect(409);
    await getRequest()
      .post(`/discovery-jobs/${job.id}/queue-items`)
      .send({ paths: [`${ROOT}\\Late`] })
      .expect(409);
  });

  it('fails a job explicitly with an error', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);

    const res = await getRequest()
      .post(`/discovery-jobs/${job.id}/fail`)
      .send({ error: 'agent lost the share' })
      .expect(200);

    expect(res.body).toMatchObject({
      status: 'failed',
      error: 'agent lost the share',
    });
  });

  it('lets a later job pick up work left behind by a cancelled one', async () => {
    const sourceId = await createSource();
    const first = await startJob(sourceId);
    await complete(await claimOk(first.id), [`${ROOT}\\Leftover`]).expect(200);
    await getRequest().post(`/discovery-jobs/${first.id}/cancel`).expect(200);

    const second = await startJob(sourceId);
    const item = await claimOk(second.id);

    expect(item.path).toBe(`${ROOT}\\Leftover`);
    expect((await getJob(second.id)).status).toBe('running');
  });
});
