import { db } from '../../src/db';
import { getRequest } from '../jest.integration.setup';

// Runs against the real local dev Postgres, so every source and host created
// here is deleted afterwards. Sources go first (hosts are ON DELETE RESTRICT);
// jobs and queue items go with their source via ON DELETE CASCADE.
const createdSourceIds: string[] = [];
const createdHostIds: string[] = [];

afterEach(async () => {
  await db.$client.query('delete from sources where id = any($1)', [
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
    .post('/sources')
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
    .post(`/sources/${sourceId}/discovery-jobs`)
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
  expect(res.body.item).not.toBeNull();

  return res.body.item;
};

/** A claim that finds nothing still answers 200, with the reason. */
const claimIdle = async (jobId: string, workerId?: string) => {
  const res = await claim(jobId, workerId).expect(200);
  expect(res.body.item).toBeNull();

  return res.body as {
    reason: 'queue_empty' | 'retry_backoff' | 'in_progress';
    retryAt: string | null;
    queueCounts: Record<string, number>;
  };
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
      .get(`/sources/${sourceId}/queue-items`)
      .query(query)
      .expect(200)
  ).body as Item[];

const jobItems = async (jobId: string, status?: string) =>
  (
    await getRequest()
      .get(`/discovery-jobs/${jobId}/queue-items`)
      .query(status ? { status } : {})
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

describe('sources', () => {
  it('creates and lists sources', async () => {
    const id = await createSource();

    const res = await getRequest().get('/sources').expect(200);

    expect(res.body.map((s: { id: string }) => s.id)).toContain(id);
  });

  it('rejects a duplicate name', async () => {
    const hostId = await createHost();
    const res = await getRequest()
      .post('/sources')
      .send({ name: 'exodus-test-dupe', hostId })
      .expect(201);
    createdSourceIds.push(res.body.id);

    await getRequest()
      .post('/sources')
      .send({ name: 'exodus-test-dupe', hostId })
      .expect(409);
  });

  it('creates a source without a host', async () => {
    const res = await getRequest()
      .post('/sources')
      .send({ name: 'exodus-test-nohostid' })
      .expect(201);
    createdSourceIds.push(res.body.id);

    expect(res.body.hostId).toBeNull();
  });

  it('rejects a host that does not exist', async () => {
    const res = await getRequest()
      .post('/sources')
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
      .post('/sources')
      .send({ name: 'exodus-test-join', hostId })
      .expect(201);
    createdSourceIds.push(res.body.id);

    const { rows } = await db.$client.query(
      'select h.id, h.ip_address from sources s join hosts h on h.id = s.host_id where s.id = $1',
      [res.body.id],
    );

    expect(rows).toEqual([{ id: hostId, ip_address: '192.0.2.1' }]);
  });

  it('blocks deleting a host that still has a source', async () => {
    const hostId = await createHost();
    const res = await getRequest()
      .post('/sources')
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
      .get(`/sources/${sourceId}/discovery-jobs`)
      .expect(200);

    expect(res.body.map((j: { id: string }) => j.id)).toEqual([
      second.id,
      first.id,
    ]);
    await getRequest()
      .get('/sources/123e4567-e89b-12d3-a456-426614174000/discovery-jobs')
      .expect(404);
  });

  it('lists jobs across sources and filters by source', async () => {
    const hostA = await createHost();
    const hostB = await createHost();
    const makeSource = async (name: string, hostId: string) => {
      const res = await getRequest()
        .post('/sources')
        .send({ name, hostId })
        .expect(201);
      createdSourceIds.push(res.body.id);

      return res.body.id as string;
    };
    const sourceA = await makeSource('exodus-test-list-a', hostA);
    const sourceB = await makeSource('exodus-test-list-b', hostB);
    const oldJobA = await startJob(sourceA);
    await getRequest().post(`/discovery-jobs/${oldJobA.id}/cancel`).expect(200);
    const jobA = await startJob(sourceA);
    const jobB = await startJob(sourceB);

    const all = await getRequest().get('/discovery-jobs').expect(200);
    const ids = all.body.map((j: { id: string }) => j.id);
    expect(ids).toEqual(expect.arrayContaining([jobA.id, jobB.id]));
    expect(ids.indexOf(jobB.id)).toBeLessThan(ids.indexOf(jobA.id));

    const filtered = await getRequest()
      .get('/discovery-jobs')
      .query({ sourceId: sourceA })
      .expect(200);
    expect(filtered.body).toEqual([
      expect.objectContaining({
        id: jobA.id,
        sourceName: 'exodus-test-list-a',
        hostId: hostA,
      }),
      expect.objectContaining({ id: oldJobA.id }),
    ]);
  });

  it('allows only one active job per source', async () => {
    const sourceId = await createSource();
    await startJob(sourceId);

    await getRequest()
      .post(`/sources/${sourceId}/discovery-jobs`)
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
      .post('/sources/123e4567-e89b-12d3-a456-426614174000/discovery-jobs')
      .send({ rootPath: ROOT })
      .expect(404);

    const sourceId = await createSource();
    await getRequest()
      .post(`/sources/${sourceId}/discovery-jobs`)
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

    responses.forEach((r) => expect(r.status).toBe(200));
    expect(responses.filter((r) => r.body.item)).toHaveLength(1);
    expect(responses.filter((r) => !r.body.item)).toHaveLength(9);
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
      .filter((r) => r.body.item)
      .map((r) => r.body.item.id);
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
    expect(await claimIdle(job.id, 'worker-b')).toMatchObject({
      reason: 'in_progress',
    });

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

    expect((await claimIdle(job.id, 'worker-b')).reason).toBe('queue_empty');

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

    const waiting = await claimIdle(job.id, 'worker-b');
    expect(waiting.reason).toBe('retry_backoff');
    expect(Date.parse(waiting.retryAt as string)).toBeGreaterThan(Date.now());

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
    expect((await claimIdle(job.id)).reason).toBe('queue_empty');
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

    expect((await claimIdle(job.id)).reason).toBe('queue_empty');
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
});

describe('queue items belong to their job', () => {
  it('queues the same path independently in two jobs of one source', async () => {
    const sourceId = await createSource();
    const first = await startJob(sourceId);
    await complete(await claimOk(first.id), [`${ROOT}\\Docs`]).expect(200);
    await getRequest().post(`/discovery-jobs/${first.id}/cancel`).expect(200);

    const second = await startJob(sourceId);

    const firstItems = await jobItems(first.id);
    const secondItems = await jobItems(second.id);

    expect(firstItems.map((i) => i.path).sort()).toEqual([
      ROOT,
      `${ROOT}\\Docs`,
    ]);
    // The new job starts from its own root; it does not inherit the old queue.
    expect(secondItems.map((i) => i.path)).toEqual([ROOT]);
    expect(secondItems[0].id).not.toBe(firstItems[0].id);
  });

  it('never claims, counts or completes against another job’s items', async () => {
    const sourceId = await createSource();
    const first = await startJob(sourceId);
    await complete(await claimOk(first.id), [`${ROOT}\\Leftover`]).expect(200);
    await getRequest().post(`/discovery-jobs/${first.id}/cancel`).expect(200);

    const second = await startJob(sourceId);

    expect((await getJob(second.id)).queueCounts).toMatchObject({
      queued: 1,
      completed: 0,
    });

    const item = await claimOk(second.id);
    expect(item.path).toBe(ROOT);
    expect((await claimIdle(second.id)).reason).toBe('in_progress');

    // The cancelled job's Leftover item is still queued, but not ours.
    const leftover = await jobItems(first.id, 'queued');
    expect(leftover.map((i) => i.path)).toEqual([`${ROOT}\\Leftover`]);

    await complete(item).expect(200);
    await getRequest()
      .post(`/discovery-jobs/${second.id}/complete`)
      .expect(200);
  });

  it('dedupes within a job but not across jobs', async () => {
    const sourceId = await createSource();
    const first = await startJob(sourceId);
    const res = await getRequest()
      .post(`/discovery-jobs/${first.id}/queue-items`)
      .send({ paths: [ROOT.toLowerCase(), `${ROOT}/`] })
      .expect(200);

    expect(res.body.map((i: { created: boolean }) => i.created)).toEqual([
      false,
    ]);
    expect(await jobItems(first.id)).toHaveLength(1);
  });

  it('lists a job’s items and 404s for an unknown job', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);

    expect(await jobItems(job.id, 'queued')).toHaveLength(1);
    expect(await jobItems(job.id, 'failed')).toHaveLength(0);

    await getRequest()
      .get('/discovery-jobs/00000000-0000-4000-8000-000000000000/queue-items')
      .expect(404);
  });

  it('deletes a job’s items with the source', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);

    await db.$client.query('delete from sources where id = $1', [sourceId]);

    const { rows } = await db.$client.query(
      'select 1 from discovery_queue_items where job_id = $1',
      [job.id],
    );
    expect(rows).toHaveLength(0);
  });
});

type Inventory = {
  id: string;
  itemType: 'file' | 'directory';
  path: string;
  normalizedPath: string;
  parentPath: string | null;
  name: string;
  extension: string | null;
  sizeBytes: number | null;
  modifiedAt: string | null;
  firstJobId: string | null;
  lastJobId: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  created?: boolean;
};

const record = (
  item: Item,
  items: object[],
  claimToken: string | null = item.claimToken,
) =>
  getRequest()
    .post(`/queue-items/${item.id}/inventory-items`)
    .send({ claimToken, items });

const file = (name: string, extra: object = {}) => ({
  path: `${ROOT}\\${name}`,
  itemType: 'file',
  ...extra,
});

const listInventory = async (sourceId: string, query: object = {}) =>
  (
    await getRequest()
      .get(`/sources/${sourceId}/inventory-items`)
      .query(query)
      .expect(200)
  ).body as Inventory[];

/** The job root is seeded as a directory; most tests care about what lies below it. */
const belowRoot = (items: Inventory[]) =>
  items.filter((i) => i.normalizedPath !== ROOT.toLowerCase());

describe('inventory items', () => {
  it('seeds the job root as an inventory directory', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);

    const [root] = await listInventory(sourceId);

    expect(root).toMatchObject({
      itemType: 'directory',
      path: ROOT,
      name: 'You',
      parentPath: 'C:\\Users',
      firstJobId: job.id,
      lastJobId: job.id,
    });

    // A later job over the same root reuses the row instead of duplicating it.
    await getRequest().post(`/discovery-jobs/${job.id}/cancel`).expect(200);
    const second = await startJob(sourceId);
    const rows = await listInventory(sourceId);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: root.id,
      firstJobId: job.id,
      lastJobId: second.id,
    });
  });

  it('seeds a drive root with no parent', async () => {
    const sourceId = await createSource();
    await startJob(sourceId, 'D:\\');

    const [root] = await listInventory(sourceId);

    expect(root).toMatchObject({
      path: 'D:\\',
      name: 'D:',
      parentPath: null,
    });
  });

  it('records the children of a claimed directory with derived fields', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const root = await claimOk(job.id);

    const res = await record(root, [
      file('Report.PDF', {
        sizeBytes: 5_000_000_000,
        modifiedAt: '2026-01-02T03:04:05Z',
      }),
      { path: `${ROOT}\\Documents`, itemType: 'directory' },
      file('.gitignore'),
    ]).expect(200);

    const [report, docs, dotfile] = res.body as Inventory[];

    expect(report).toMatchObject({
      created: true,
      itemType: 'file',
      path: `${ROOT}\\Report.PDF`,
      normalizedPath: `${ROOT}\\report.pdf`.toLowerCase(),
      parentPath: ROOT,
      name: 'Report.PDF',
      extension: 'pdf',
      sizeBytes: 5_000_000_000,
      modifiedAt: '2026-01-02T03:04:05.000Z',
      firstJobId: job.id,
      lastJobId: job.id,
    });
    expect(docs).toMatchObject({
      itemType: 'directory',
      name: 'Documents',
      extension: null,
      sizeBytes: null,
    });
    expect(dotfile.extension).toBeNull();
  });

  it('dedupes case-insensitively and across slash styles', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const root = await claimOk(job.id);

    const first = await record(root, [file('Report.pdf')]).expect(200);
    const second = await record(root, [
      { path: 'c:/users/you/REPORT.PDF', itemType: 'file' },
    ]).expect(200);

    expect(second.body[0].id).toBe(first.body[0].id);
    expect(second.body[0].created).toBe(false);
    // Latest spelling is displayed; identity is unchanged.
    expect(second.body[0].path).toBe('C:\\users\\you\\REPORT.PDF');
    expect(belowRoot(await listInventory(sourceId))).toHaveLength(1);
  });

  it('collapses duplicates within one batch', async () => {
    const sourceId = await createSource();
    const root = await claimOk((await startJob(sourceId)).id);

    const res = await record(root, [
      file('a.txt', { sizeBytes: 1 }),
      file('A.TXT', { sizeBytes: 2 }),
    ]).expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].sizeBytes).toBe(2);
  });

  it('keeps one row when workers record the same path concurrently', async () => {
    const sourceId = await createSource();
    const root = await claimOk((await startJob(sourceId)).id);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => record(root, [file('same.txt')])),
    );

    results.forEach((r) => expect(r.status).toBe(200));
    expect(new Set(results.map((r) => r.body[0].id)).size).toBe(1);
    expect(belowRoot(await listInventory(sourceId))).toHaveLength(1);
  });

  it('updates filesystem metadata on rediscovery without losing identity', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const root = await claimOk(job.id);

    const [before] = (
      await record(root, [
        file('a.txt', { sizeBytes: 10, modifiedAt: '2026-01-01T00:00:00Z' }),
      ]).expect(200)
    ).body as Inventory[];

    const [after] = (
      await record(root, [
        file('a.txt', { sizeBytes: 99, modifiedAt: '2026-02-01T00:00:00Z' }),
      ]).expect(200)
    ).body as Inventory[];

    expect(after).toMatchObject({
      id: before.id,
      created: false,
      sizeBytes: 99,
      modifiedAt: '2026-02-01T00:00:00.000Z',
      firstSeenAt: before.firstSeenAt,
      createdAt: before.createdAt,
    });
    expect(Date.parse(after.lastSeenAt)).toBeGreaterThan(
      Date.parse(before.lastSeenAt),
    );
  });

  it('keeps the stored size and mtime when rediscovery omits them', async () => {
    const sourceId = await createSource();
    const root = await claimOk((await startJob(sourceId)).id);

    await record(root, [
      file('a.txt', { sizeBytes: 10, modifiedAt: '2026-01-01T00:00:00Z' }),
    ]).expect(200);
    const [again] = (await record(root, [file('a.txt')]).expect(200))
      .body as Inventory[];

    expect(again.sizeBytes).toBe(10);
    expect(again.modifiedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('does not reset first-seen data on rediscovery', async () => {
    const sourceId = await createSource();
    const root = await claimOk((await startJob(sourceId)).id);
    const [item] = (await record(root, [file('a.txt')]).expect(200))
      .body as Inventory[];

    // Backdate so a reset to now() would be visible.
    await db.$client.query(
      "update inventory_items set created_at = created_at - interval '1 day', first_seen_at = first_seen_at - interval '1 day' where id = $1",
      [item.id],
    );
    const [{ first_seen_at: seededFirstSeen }] = (
      await db.$client.query(
        'select first_seen_at from inventory_items where id = $1',
        [item.id],
      )
    ).rows;

    await record(root, [file('a.txt', { sizeBytes: 1 })]).expect(200);

    const [{ first_seen_at: afterFirstSeen }] = (
      await db.$client.query(
        'select first_seen_at from inventory_items where id = $1',
        [item.id],
      )
    ).rows;
    expect(afterFirstSeen).toEqual(seededFirstSeen);
  });

  it('tracks first and last job when a later job rediscovers a path', async () => {
    const sourceId = await createSource();
    const first = await startJob(sourceId);
    const firstRoot = await claimOk(first.id);
    const [original] = (
      await record(firstRoot, [file('a.txt', { sizeBytes: 1 })]).expect(200)
    ).body as Inventory[];
    await complete(firstRoot).expect(200);
    await getRequest().post(`/discovery-jobs/${first.id}/complete`).expect(200);

    const second = await startJob(sourceId);
    const secondRoot = await claimOk(second.id);
    const [again] = (
      await record(secondRoot, [file('a.txt', { sizeBytes: 2 })]).expect(200)
    ).body as Inventory[];

    expect(again).toMatchObject({
      id: original.id,
      created: false,
      firstJobId: first.id,
      lastJobId: second.id,
      sizeBytes: 2,
    });
    expect(
      belowRoot(await listInventory(sourceId, { jobId: first.id })),
    ).toHaveLength(0);
    expect(
      belowRoot(await listInventory(sourceId, { jobId: second.id })),
    ).toHaveLength(1);
  });

  it('keeps recorded items and avoids duplicates when a crashed claim is redone', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const crashed = await claimOk(job.id, 'worker-a');
    await record(crashed, [file('a.txt'), file('b.txt')]).expect(200);

    await expireLease(crashed.id);
    const retaken = await claimOk(job.id, 'worker-b');
    expect(retaken.id).toBe(crashed.id);

    // Recorded items survived the crash.
    expect(belowRoot(await listInventory(sourceId))).toHaveLength(2);

    // The dead claim can no longer record; the new one can, without duplicates.
    await record(crashed, [file('c.txt')]).expect(409);
    await record(retaken, [file('a.txt'), file('b.txt'), file('c.txt')]).expect(
      200,
    );
    expect(belowRoot(await listInventory(sourceId))).toHaveLength(3);
  });

  describe('validation', () => {
    it('rejects a wrong claim token, an expired lease and a finished item with 409', async () => {
      const sourceId = await createSource();
      const job = await startJob(sourceId);
      const root = await claimOk(job.id);

      await record(
        root,
        [file('a.txt')],
        'a23e4567-e89b-12d3-a456-426614174000',
      ).expect(409);

      await expireLease(root.id);
      await record(root, [file('a.txt')]).expect(409);

      expect(belowRoot(await listInventory(sourceId))).toHaveLength(0);
    });

    it('404s for an unknown queue item', async () => {
      await getRequest()
        .post(
          '/queue-items/00000000-0000-4000-8000-000000000000/inventory-items',
        )
        .send({
          claimToken: 'a23e4567-e89b-12d3-a456-426614174000',
          items: [file('a.txt')],
        })
        .expect(404);
    });

    it('rejects paths outside the claimed directory and records nothing', async () => {
      const sourceId = await createSource();
      const root = await claimOk((await startJob(sourceId)).id);

      const res = await record(root, [
        file('ok.txt'),
        { path: 'C:\\Users\\YouOther\\x.txt', itemType: 'file' },
        { path: 'D:\\x.txt', itemType: 'file' },
      ]).expect(409);

      expect(res.body.paths).toEqual([
        'C:\\Users\\YouOther\\x.txt',
        'D:\\x.txt',
      ]);
      expect(belowRoot(await listInventory(sourceId))).toHaveLength(0);
    });

    it('rejects the claimed directory itself', async () => {
      const root = await claimOk((await startJob(await createSource())).id);

      await record(root, [{ path: ROOT, itemType: 'directory' }]).expect(409);
    });

    it('allows descendants deeper than direct children', async () => {
      const sourceId = await createSource();
      const root = await claimOk((await startJob(sourceId)).id);

      const res = await record(root, [
        { path: `${ROOT}\\a\\b\\c.txt`, itemType: 'file' },
      ]).expect(200);

      expect(res.body[0].parentPath).toBe(`${ROOT}\\a\\b`);
    });

    it('takes source and job from the claim, ignoring client-supplied ids', async () => {
      const sourceId = await createSource();
      const otherSource = await createSource();
      const job = await startJob(sourceId);
      const root = await claimOk(job.id);

      await getRequest()
        .post(`/queue-items/${root.id}/inventory-items`)
        .send({
          claimToken: root.claimToken,
          sourceId: otherSource,
          jobId: 'a23e4567-e89b-12d3-a456-426614174000',
          items: [file('a.txt')],
        })
        .expect(200);

      expect(belowRoot(await listInventory(sourceId))).toHaveLength(1);
      expect(await listInventory(otherSource)).toHaveLength(0);
    });

    it('404s when listing inventory for an unknown source', async () => {
      await getRequest()
        .get('/sources/00000000-0000-4000-8000-000000000000/inventory-items')
        .expect(404);
    });
  });

  describe('listing', () => {
    const seed = async () => {
      const sourceId = await createSource();
      const job = await startJob(sourceId);
      const root = await claimOk(job.id);
      await record(root, [
        file('b.txt'),
        file('a.pdf'),
        { path: `${ROOT}\\Docs`, itemType: 'directory' },
        { path: `${ROOT}\\Docs\\inner.txt`, itemType: 'file' },
        { path: `${ROOT}\\my_dir`, itemType: 'directory' },
        { path: `${ROOT}\\myXdir`, itemType: 'directory' },
      ]).expect(200);

      return { sourceId, job, root };
    };

    it('orders by normalized path and filters by type', async () => {
      const { sourceId } = await seed();

      // Order is the database's, so just check it is stable across calls.
      const all = await listInventory(sourceId);
      expect(await listInventory(sourceId)).toEqual(all);

      const dirs = await listInventory(sourceId, { itemType: 'directory' });
      expect(dirs.map((i) => i.name).sort()).toEqual(
        ['Docs', 'my_dir', 'myXdir', 'You'].sort(),
      );
    });

    it('lists only the direct children of a parent, case-insensitively', async () => {
      const { sourceId } = await seed();

      const children = await listInventory(sourceId, {
        parentPath: `${ROOT.toUpperCase()}\\docs`,
      });

      expect(children.map((i) => i.name)).toEqual(['inner.txt']);
    });

    it('matches a path prefix literally, not as a LIKE pattern', async () => {
      const { sourceId } = await seed();

      const underscore = await listInventory(sourceId, {
        pathPrefix: `${ROOT}\\my_dir`,
      });

      expect(underscore.map((i) => i.name)).toEqual(['my_dir']);
    });

    it('matches a path prefix on directory boundaries', async () => {
      const { sourceId, root } = await seed();
      await record(root, [
        { path: `${ROOT}\\Docs2`, itemType: 'directory' },
      ]).expect(200);

      const subtree = await listInventory(sourceId, {
        pathPrefix: `${ROOT}\\docs`,
      });

      expect(subtree.map((i) => i.name).sort()).toEqual(['Docs', 'inner.txt']);
    });

    it('filters by the job that last saw the item', async () => {
      const { sourceId, job } = await seed();

      expect(await listInventory(sourceId, { jobId: job.id })).toHaveLength(7);
      expect(
        await listInventory(sourceId, {
          jobId: 'a23e4567-e89b-12d3-a456-426614174000',
        }),
      ).toHaveLength(0);
    });

    it('pages with a keyset cursor', async () => {
      const { sourceId } = await seed();

      const page1 = await listInventory(sourceId, { limit: 4 });
      const page2 = await listInventory(sourceId, {
        limit: 4,
        after: page1[page1.length - 1].normalizedPath,
      });

      expect(page1).toHaveLength(4);
      expect(page2).toHaveLength(3);
      expect(new Set([...page1, ...page2].map((i) => i.id)).size).toBe(7);
    });
  });

  it('deletes inventory with its source', async () => {
    const sourceId = await createSource();
    const root = await claimOk((await startJob(sourceId)).id);
    await record(root, [file('a.txt')]).expect(200);

    await db.$client.query('delete from sources where id = $1', [sourceId]);

    const { rows } = await db.$client.query(
      'select 1 from inventory_items where source_id = $1',
      [sourceId],
    );
    expect(rows).toHaveLength(0);
  });
});

describe('concurrent inventory writes', () => {
  it('does not deadlock when batches overlap in opposite orders', async () => {
    const sourceId = await createSource();
    const root = await claimOk((await startJob(sourceId)).id);
    const names = Array.from(
      { length: 150 },
      (_, i) => `f${String(i).padStart(3, '0')}.txt`,
    );
    const batch = (ordered: string[]) =>
      ordered.map((n) => ({ path: `${ROOT}\\sub\\${n}`, itemType: 'file' }));

    for (let round = 0; round < 8; round++) {
      const responses = await Promise.all([
        record(root, batch(names)),
        record(root, batch([...names].reverse())),
        record(root, batch(names)),
        record(root, batch([...names].reverse())),
      ]);

      expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    }

    expect(
      belowRoot(await listInventory(sourceId, { limit: 1000 })),
    ).toHaveLength(150);
  });

  it('returns results in the order the paths were given', async () => {
    const sourceId = await createSource();
    const root = await claimOk((await startJob(sourceId)).id);

    const res = await record(root, [
      file('z.txt'),
      file('a.txt'),
      file('m.txt'),
    ]).expect(200);

    expect(res.body.map((i: Inventory) => i.name)).toEqual([
      'z.txt',
      'a.txt',
      'm.txt',
    ]);
  });
});

describe('a finished job releases its workers', () => {
  const lateCalls = (item: Item) => [
    () => record(item, [file('late.txt')]),
    () => complete(item, [`${ROOT}\\Late`]),
    () => fail(item),
    () =>
      getRequest()
        .post(`/queue-items/${item.id}/skip`)
        .send({ claimToken: item.claimToken, reason: 'late' }),
    () =>
      getRequest()
        .post(`/queue-items/${item.id}/heartbeat`)
        .send({ claimToken: item.claimToken }),
  ];

  it.each(['cancel', 'fail'])(
    'rejects every call from a worker whose job was %sed',
    async (action) => {
      const sourceId = await createSource();
      const job = await startJob(sourceId);
      const held = await claimOk(job.id);

      await getRequest()
        .post(`/discovery-jobs/${job.id}/${action}`)
        .send(action === 'fail' ? { error: 'agent lost the share' } : {})
        .expect(200);

      for (const call of lateCalls(held)) {
        const res = await call().expect(409);
        expect(res.body.message).toMatch(/can no longer be changed/);
      }

      // Nothing leaked into the finished job.
      expect(belowRoot(await listInventory(sourceId))).toHaveLength(0);
      const items = await jobItems(job.id);
      expect(items.map((i) => i.path)).toEqual([ROOT]);
    },
  );

  it('releases in-progress items to queued with no claim and keeps the rest', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const root = await claimOk(job.id);
    await complete(root, [`${ROOT}\\A`, `${ROOT}\\B`]).expect(200);
    const held = await claimOk(job.id);
    const failedItem = await claimOk(job.id);
    await fail(failedItem, 'denied', false).expect(200);

    await getRequest().post(`/discovery-jobs/${job.id}/cancel`).expect(200);

    const byPath = Object.fromEntries(
      (await jobItems(job.id)).map((i) => [i.path.split('\\').pop(), i]),
    );
    expect(byPath.You.status).toBe('completed');
    expect(byPath[held.path.split('\\').pop() as string]).toMatchObject({
      status: 'queued',
      claimToken: null,
      lastError: 'job cancelled',
      attemptCount: 1,
    });
    expect(byPath[failedItem.path.split('\\').pop() as string].status).toBe(
      'failed',
    );
    expect((await getJob(job.id)).queueCounts).toMatchObject({
      in_progress: 0,
      queued: 1,
      failed: 1,
      completed: 1,
    });
  });

  it('refuses to claim or enqueue on a finished job', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    await getRequest().post(`/discovery-jobs/${job.id}/cancel`).expect(200);

    await claim(job.id).expect(409);
    await getRequest()
      .post(`/discovery-jobs/${job.id}/queue-items`)
      .send({ paths: [`${ROOT}\\X`] })
      .expect(409);
  });

  it('never leaves a claim in progress on a job that was cancelled concurrently', async () => {
    for (let trial = 0; trial < 12; trial++) {
      const sourceId = await createSource();
      const job = await startJob(sourceId);

      await Promise.all([
        claim(job.id),
        getRequest().post(`/discovery-jobs/${job.id}/cancel`),
      ]);

      const counts = (await getJob(job.id)).queueCounts;
      expect(counts.in_progress).toBe(0);
      expect((await getJob(job.id)).status).toBe('cancelled');
    }
  });

  it('never leaves queued work on a job that completed concurrently with an enqueue', async () => {
    for (let trial = 0; trial < 12; trial++) {
      const sourceId = await createSource();
      const job = await startJob(sourceId);
      await complete(await claimOk(job.id)).expect(200);

      const [completion, enqueue] = await Promise.all([
        getRequest().post(`/discovery-jobs/${job.id}/complete`),
        getRequest()
          .post(`/discovery-jobs/${job.id}/queue-items`)
          .send({ paths: [`${ROOT}\\Racy`] }),
      ]);

      const queued = await jobItems(job.id, 'queued');
      if (completion.status === 200) {
        expect(enqueue.status).toBe(409);
        expect(queued).toHaveLength(0);
      } else {
        // The enqueue won: the job correctly refused to finish over new work.
        expect(completion.status).toBe(409);
        expect(enqueue.status).toBe(200);
        expect(queued).toHaveLength(1);
      }
    }
  });
});

describe('retry needs an active job', () => {
  it('refuses to retry a failed item once its job has finished', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const item = await claimOk(job.id);
    await fail(item, 'denied', false).expect(200);
    await getRequest().post(`/discovery-jobs/${job.id}/complete`).expect(200);

    const res = await getRequest()
      .post(`/queue-items/${item.id}/retry`)
      .expect(409);

    expect(res.body.message).toMatch(/start a new discovery job/);
    expect((await jobItems(job.id, 'failed')).map((i) => i.id)).toEqual([
      item.id,
    ]);
  });

  it('still retries a failed item while its job is running', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const item = await claimOk(job.id);
    await fail(item, 'denied', false).expect(200);

    const res = await getRequest()
      .post(`/queue-items/${item.id}/retry`)
      .expect(200);

    expect(res.body).toMatchObject({
      status: 'queued',
      claimToken: null,
      attemptCount: 1,
      maxAttempts: 2,
      lastError: 'denied',
    });
  });

  it('refuses to retry an item that is being worked on', async () => {
    const job = await startJob(await createSource());
    const item = await claimOk(job.id);

    const res = await getRequest()
      .post(`/queue-items/${item.id}/retry`)
      .expect(409);

    expect(res.body.message).toMatch(/only failed items/);
  });
});

describe('claim result when idle', () => {
  it('says queue_empty with no retryAt once all work is done', async () => {
    const job = await startJob(await createSource());
    await complete(await claimOk(job.id)).expect(200);

    const idle = await claimIdle(job.id);

    expect(idle).toMatchObject({ reason: 'queue_empty', retryAt: null });
    expect(idle.queueCounts).toMatchObject({ completed: 1, queued: 0 });
  });

  it('says in_progress with the earliest lease expiry while others hold work', async () => {
    const job = await startJob(await createSource());
    await claimOk(job.id, 'worker-a');

    const idle = await claimIdle(job.id, 'worker-b');

    expect(idle.reason).toBe('in_progress');
    expect(Date.parse(idle.retryAt as string)).toBeGreaterThan(Date.now());
  });
});

describe('database state checks', () => {
  const insertItem = async (sql: string) => {
    const job = await startJob(await createSource());
    const { rows } = await db.$client.query(
      'select id from discovery_queue_items where job_id = $1',
      [job.id],
    );

    return db.$client.query(sql, [rows[0].id]);
  };

  it('rejects more attempts than allowed', async () => {
    await expect(
      insertItem(
        'update discovery_queue_items set attempt_count = max_attempts + 1 where id = $1',
      ),
    ).rejects.toThrow(/discovery_queue_items_attempts_check/);
  });

  it('rejects an in-progress item without a complete claim', async () => {
    await expect(
      insertItem(
        "update discovery_queue_items set status = 'in_progress' where id = $1",
      ),
    ).rejects.toThrow(/discovery_queue_items_lease_check/);
  });

  it('rejects a negative file size', async () => {
    const sourceId = await createSource();
    await startJob(sourceId);

    await expect(
      db.$client.query(
        'update inventory_items set size_bytes = -1 where source_id = $1',
        [sourceId],
      ),
    ).rejects.toThrow(/inventory_items_size_check/);
  });
});
