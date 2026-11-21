import { db } from '../../src/db';
import { getRequest } from '../jest.integration.setup';

// Runs against the real local dev Postgres, so everything created here is
// deleted afterwards. Sources cascade to jobs, queue items and inventory
// items; the audit log (which has no foreign keys by design) is removed
// explicitly.
const createdSourceIds: string[] = [];
const createdHostIds: string[] = [];

afterEach(async () => {
  await db.$client.query('delete from audit_events where source_id = any($1)', [
    createdSourceIds,
  ]);
  await db.$client.query('delete from sources where id = any($1)', [
    createdSourceIds,
  ]);
  await db.$client.query('delete from hosts where id = any($1)', [
    createdHostIds,
  ]);
  createdSourceIds.length = 0;
  createdHostIds.length = 0;
});

const ROOT = 'C:\\Users\\You';
const unique = () => Math.random().toString(36).slice(2);

const createSource = async (): Promise<string> => {
  const host = await getRequest()
    .post('/hosts')
    .send({ name: `exodus-test-host-${unique()}`, ipAddress: '192.0.2.1' })
    .expect(201);
  createdHostIds.push(host.body.id);

  const res = await getRequest()
    .post('/sources')
    .send({ name: `exodus-test-${unique()}`, hostId: host.body.id })
    .expect(201);
  createdSourceIds.push(res.body.id);

  return res.body.id;
};

const startJob = async (sourceId: string) =>
  (
    await getRequest()
      .post(`/sources/${sourceId}/discovery-jobs`)
      .send({ rootPath: ROOT })
      .expect(201)
  ).body as { id: string };

const claim = (jobId: string) =>
  getRequest()
    .post(`/discovery-jobs/${jobId}/queue-items/claim`)
    .send({ workerId: 'worker-a', leaseSeconds: 300 })
    .expect(200);

type ClaimedItem = { id: string; path: string; claimToken: string };

const claimItem = async (jobId: string): Promise<ClaimedItem> => {
  const res = await claim(jobId);
  expect(res.body.item).not.toBeNull();

  return res.body.item;
};

/** A minimal valid proposal; only its path matters to the audit tests. */
const inventoryItem = (path: string) => ({
  rootPath: path,
  kind: 'directory',
  summary: 'x',
  recommendation: 'needs_review',
  confidence: 'low',
  reason: 'x',
  evidence: {
    contentKinds: [],
    git: null,
    reproducible: 'unknown',
    sufficientInformation: false,
    observations: [],
    openQuestions: [],
  },
});

/** Starts a job over ROOT and claims its root directory. */
const claimRoot = async (sourceId: string) => {
  const job = await startJob(sourceId);

  return { job, root: await claimItem(job.id) };
};

const propose = (root: ClaimedItem, paths: string[]) =>
  getRequest()
    .post(`/queue-items/${root.id}/inventory-items`)
    .send({
      claimToken: root.claimToken,
      inventoryItems: paths.map(inventoryItem),
    });

const auditEvents = async (query: Record<string, string | number> = {}) =>
  (await getRequest().get('/audit-events').query(query).expect(200)).body as {
    id: string;
    eventType: string;
    actorType: string;
    actorId: string | null;
    sourceId: string | null;
    jobId: string | null;
    inventoryItemId: string | null;
    details: Record<string, unknown>;
    createdAt: string;
  }[];

describe('audit events', () => {
  it('records an inventory item proposal against its source and job', async () => {
    const sourceId = await createSource();
    const { job, root } = await claimRoot(sourceId);
    await propose(root, [`${ROOT}\\docs`]).expect(200);

    const events = await auditEvents({ sourceId });
    expect(events.map((e) => e.eventType)).toEqual(['inventory_item.created']);
    expect(events[0]).toMatchObject({ sourceId, jobId: job.id });
  });

  it('filters by source, job, event type and time range', async () => {
    const [a, b] = [await createSource(), await createSource()];
    const { job, root } = await claimRoot(a);
    await propose(root, [`${ROOT}\\one`, `${ROOT}\\two`]).expect(200);
    const other = await claimRoot(b);
    await propose(other.root, [`${ROOT}\\three`]).expect(200);

    expect((await auditEvents({ sourceId: a })).length).toBe(2);
    expect((await auditEvents({ sourceId: b })).length).toBe(1);
    expect(
      (await auditEvents({ sourceId: a, eventType: 'inventory_item.created' }))
        .length,
    ).toBe(2);
    expect(
      (
        await auditEvents({
          sourceId: a,
          eventType: 'inventory_item.decision_changed',
        })
      ).length,
    ).toBe(0);
    expect((await auditEvents({ jobId: job.id })).length).toBe(2);

    const now = Date.now();
    const hour = 3_600_000;
    expect(
      (
        await auditEvents({
          sourceId: a,
          since: new Date(now - hour).toISOString(),
          until: new Date(now + hour).toISOString(),
        })
      ).length,
    ).toBe(2);
    expect(
      await auditEvents({
        sourceId: a,
        until: new Date(now - hour).toISOString(),
      }),
    ).toHaveLength(0);
    expect(
      await auditEvents({
        sourceId: a,
        since: new Date(now + hour).toISOString(),
      }),
    ).toHaveLength(0);
  });

  it('pages newest first with a stable cursor', async () => {
    const sourceId = await createSource();
    const { root } = await claimRoot(sourceId);
    for (let i = 0; i < 5; i++) {
      await propose(root, [`${ROOT}\\p${i}`]).expect(200);
    }

    const all = await auditEvents({ sourceId });
    expect(all).toHaveLength(5);

    const page1 = await auditEvents({ sourceId, limit: 2 });
    const page2 = await auditEvents({
      sourceId,
      limit: 2,
      before: page1[1].id,
    });
    const page3 = await auditEvents({
      sourceId,
      limit: 2,
      before: page2[1].id,
    });

    expect([...page1, ...page2, ...page3].map((e) => e.id)).toEqual(
      all.map((e) => e.id),
    );
    expect(page3).toHaveLength(1);
  });

  it('exposes no write endpoints', async () => {
    await getRequest().post('/audit-events').send({}).expect(404);
    await getRequest()
      .delete('/audit-events/123e4567-e89b-12d3-a456-426614174000')
      .expect(404);
  });
});
