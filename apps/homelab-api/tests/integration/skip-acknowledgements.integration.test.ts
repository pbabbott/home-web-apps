import { db } from '../../src/db';
import { getRequest } from '../jest.integration.setup';
import type { ClaimedItem } from './fixtures/selective-agent';

// Runs against the real local dev Postgres; sources cascade to everything
// they own, and the audit log (no foreign keys by design) is cleared by source.
const createdSourceIds: string[] = [];

afterEach(async () => {
  await db.$client.query('delete from audit_events where source_id = any($1)', [
    createdSourceIds,
  ]);
  await db.$client.query('delete from sources where id = any($1)', [
    createdSourceIds,
  ]);
  createdSourceIds.length = 0;
});

const DOWNLOADS = 'C:\\Users\\Me\\Downloads';
const KEEPER = `${DOWNLOADS}\\tax-return.pdf`;
const HUMAN = { 'X-Actor-Id': 'brandon' };

const createSource = async (): Promise<string> => {
  const res = await getRequest()
    .post('/sources')
    .send({ name: `exodus-ack-${Math.random().toString(36).slice(2)}` })
    .expect(201);
  createdSourceIds.push(res.body.id);

  return res.body.id;
};

/** Starts a job on Downloads, claims it, and completes it with skips. */
const skipInJob = async (sourceId: string) => {
  const job = (
    await getRequest()
      .post(`/sources/${sourceId}/discovery-jobs`)
      .send({ rootPath: DOWNLOADS })
      .expect(201)
  ).body as { id: string };
  const item = (
    await getRequest()
      .post(`/discovery-jobs/${job.id}/queue-items/claim`)
      .send({ workerId: 'w1', leaseSeconds: 300 })
      .expect(200)
  ).body.item as ClaimedItem;

  await getRequest()
    .post(`/queue-items/${item.id}/complete`)
    .send({
      claimToken: item.claimToken,
      skipped: [{ path: KEEPER, reason: 'looked like a download' }],
      skippedGroups: [{ pattern: '*.msi', reason: 'installers' }],
    })
    .expect(200);
  await getRequest().post(`/discovery-jobs/${job.id}/complete`).expect(200);

  return item;
};

const acknowledge = (
  item: ClaimedItem,
  body: object,
  headers: Record<string, string> = HUMAN,
) =>
  getRequest()
    .post(`/queue-items/${item.id}/skip-acknowledgements`)
    .set(headers)
    .send(body);

const unacknowledge = (
  item: ClaimedItem,
  body: object,
  headers: Record<string, string> = HUMAN,
) =>
  getRequest()
    .delete(`/queue-items/${item.id}/skip-acknowledgements`)
    .set(headers)
    .send(body);

const reviewDisk = (
  item: ClaimedItem,
  headers: Record<string, string> = HUMAN,
) => getRequest().post(`/queue-items/${item.id}/on-disk-review`).set(headers);

const unreviewDisk = (
  item: ClaimedItem,
  headers: Record<string, string> = HUMAN,
) => getRequest().delete(`/queue-items/${item.id}/on-disk-review`).set(headers);

const list = async (sourceId: string, query: Record<string, string> = {}) =>
  (
    await getRequest()
      .get(`/sources/${sourceId}/skip-acknowledgements`)
      .query(query)
      .expect(200)
  ).body as Record<string, any>[];

const events = async (sourceId: string) =>
  (
    await db.$client.query(
      'select event_type, actor_type, actor_id, details from audit_events where source_id = $1 order by created_at',
      [sourceId],
    )
  ).rows as Record<string, any>[];

describe('acknowledging a skipped path', () => {
  it('records it, lists it, and writes one audit event', async () => {
    const sourceId = await createSource();
    const item = await skipInJob(sourceId);

    const res = await acknowledge(item, { path: KEEPER }).expect(201);

    expect(res.body).toMatchObject({
      sourceId,
      path: KEEPER,
      pattern: '',
      acknowledgedBy: 'brandon',
    });
    expect(await list(sourceId)).toHaveLength(1);
    expect(
      (await events(sourceId)).filter(
        (e) => e.event_type === 'skip.acknowledged',
      ),
    ).toEqual([
      expect.objectContaining({
        actor_type: 'human',
        actor_id: 'brandon',
        details: { path: KEEPER },
      }),
    ]);
  });

  it('is idempotent and case-insensitive, with a single audit event', async () => {
    const sourceId = await createSource();
    const item = await skipInJob(sourceId);

    const first = await acknowledge(item, { path: KEEPER }).expect(201);
    const again = await acknowledge(item, {
      path: KEEPER.toLowerCase(),
    }).expect(201);

    expect(again.body.id).toBe(first.body.id);
    expect(await list(sourceId)).toHaveLength(1);
    expect(
      (await events(sourceId)).filter(
        (e) => e.event_type === 'skip.acknowledged',
      ),
    ).toHaveLength(1);
  });

  it('keeps a pattern skip apart from a path skip, keyed on the directory', async () => {
    const sourceId = await createSource();
    const item = await skipInJob(sourceId);

    await acknowledge(item, { path: DOWNLOADS, pattern: '*.msi' }).expect(201);
    await acknowledge(item, { path: KEEPER }).expect(201);

    const rows = await list(sourceId);
    expect(rows.map((r) => r.pattern).sort()).toEqual(['', '*.msi']);
  });

  it('only a human may acknowledge or take it back', async () => {
    const sourceId = await createSource();
    const item = await skipInJob(sourceId);
    const agent = { 'X-Actor-Type': 'openclaw', 'X-Actor-Id': 'agent' };

    await acknowledge(item, { path: KEEPER }, agent).expect(409);
    await acknowledge(item, { path: KEEPER }).expect(201);
    await unacknowledge(item, { path: KEEPER }, agent).expect(409);

    expect(await list(sourceId)).toHaveLength(1);
  });

  it('refuses a plain path outside, or equal to, the queue item’s directory', async () => {
    const sourceId = await createSource();
    const item = await skipInJob(sourceId);

    await acknowledge(item, { path: 'C:\\Users\\Me\\Documents\\a.pdf' }).expect(
      409,
    );
    await acknowledge(item, { path: DOWNLOADS }).expect(409);

    expect(await list(sourceId)).toHaveLength(0);
  });

  it('can be taken back, with an audit event, and 404s when absent', async () => {
    const sourceId = await createSource();
    const item = await skipInJob(sourceId);

    await unacknowledge(item, { path: KEEPER }).expect(404);
    await acknowledge(item, { path: KEEPER }).expect(201);
    await unacknowledge(item, { path: KEEPER }).expect(204);

    expect(await list(sourceId)).toHaveLength(0);
    expect((await events(sourceId)).map((e) => e.event_type)).toEqual([
      'skip.acknowledged',
      'skip.unacknowledged',
    ]);
  });

  it('holds for a later job of the same source', async () => {
    const sourceId = await createSource();
    const first = await skipInJob(sourceId);
    await acknowledge(first, { path: KEEPER }).expect(201);

    await skipInJob(sourceId);

    expect(await list(sourceId, { pathPrefix: DOWNLOADS })).toHaveLength(1);
    expect(await list(sourceId, { pathPrefix: 'C:\\Elsewhere' })).toHaveLength(
      0,
    );
  });
});

describe('skip review on a job’s directories', () => {
  const jobOf = async (item: ClaimedItem) =>
    (await getRequest().get(`/queue-items/${item.id}`).expect(200)).body.job
      .id as string;
  const listed = async (item: ClaimedItem) =>
    (
      await getRequest()
        .get(`/discovery-jobs/${await jobOf(item)}/queue-items`)
        .expect(200)
    ).body.find((entry: { id: string }) => entry.id === item.id);

  it('flips reviewed once every path and pattern is acknowledged, and flags each skip on the item', async () => {
    const sourceId = await createSource();
    const item = await skipInJob(sourceId);

    expect((await listed(item)).reviewed).toBe(false);

    await acknowledge(item, { path: KEEPER }).expect(201);
    expect((await listed(item)).reviewed).toBe(false);

    await acknowledge(item, { path: DOWNLOADS, pattern: '*.msi' }).expect(201);
    // Skips alone are not enough: what is on disk must be acknowledged too.
    expect((await listed(item)).reviewed).toBe(false);

    await reviewDisk(item).expect(201);
    expect((await listed(item)).reviewed).toBe(true);

    const detail = (
      await getRequest().get(`/queue-items/${item.id}`).expect(200)
    ).body;
    expect(detail.skipReview).toEqual({
      reviewed: true,
      paths: [{ path: KEEPER, acknowledged: true, inventoried: false }],
      patterns: [{ pattern: '*.msi', acknowledged: true }],
    });
    expect(detail.job.sourceId).toBe(sourceId);
    expect(detail.directoryApproved).toBe(false);
    expect(detail.reviewed).toBe(true);
    expect(detail.onDiskReview).toMatchObject({ reviewedBy: 'brandon' });

    await unacknowledge(item, { path: KEEPER }).expect(204);
    expect((await listed(item)).reviewed).toBe(false);
  });

  it('counts a promoted path as reviewed', async () => {
    const sourceId = await createSource();
    const item = await skipInJob(sourceId);
    await acknowledge(item, { path: DOWNLOADS, pattern: '*.msi' }).expect(201);
    await reviewDisk(item).expect(201);

    const promoted = (
      await getRequest()
        .post(`/queue-items/${item.id}/promote`)
        .set(HUMAN)
        .send({ path: KEEPER, kind: 'file' })
        .expect(201)
    ).body as { id: string };

    const detail = (
      await getRequest().get(`/queue-items/${item.id}`).expect(200)
    ).body;
    expect(detail.skipReview.paths[0]).toMatchObject({ inventoried: true });
    expect(detail.skipReview.reviewed).toBe(true);
    expect(detail).toMatchObject({
      inventoryCount: 1,
      inventoryByDecision: { pending: 0, approved: 1, rejected: 0 },
    });
    expect((await listed(item)).inventoryByDecision.approved).toBe(1);
    expect((await listed(item)).reviewed).toBe(true);

    // A pending inventory decision keeps the directory from counting as reviewed.
    const decide = (decision: string) =>
      getRequest()
        .patch(`/inventory-items/${promoted.id}/decision`)
        .set(HUMAN)
        .send({ decision })
        .expect(200);
    await decide('pending');
    expect((await listed(item)).reviewed).toBe(false);
    expect(
      (await getRequest().get(`/queue-items/${item.id}`).expect(200)).body,
    ).toMatchObject({ reviewed: false });

    await decide('rejected');
    expect((await listed(item)).reviewed).toBe(true);
  });

  it('404s for an unknown queue item', async () => {
    await getRequest()
      .get('/queue-items/123e4567-e89b-42d3-a456-426614174000')
      .expect(404);
  });
});

describe('acknowledging the on-disk contents', () => {
  const eventTypes = async (sourceId: string) =>
    (
      await getRequest().get('/audit-events').query({ sourceId }).expect(200)
    ).body.map((e: { eventType: string }) => e.eventType);

  it('is recorded once, undoable, and reflected on the item', async () => {
    const sourceId = await createSource();
    const item = await skipInJob(sourceId);
    const get = async () =>
      (await getRequest().get(`/queue-items/${item.id}`).expect(200)).body;

    expect((await get()).onDiskReview).toBeNull();

    const first = await reviewDisk(item).expect(201);
    expect(first.body).toMatchObject({
      sourceId,
      path: DOWNLOADS,
      reviewedBy: 'brandon',
    });
    // Idempotent: the same row comes back and no second event is written.
    const again = await reviewDisk(item).expect(201);
    expect(again.body.id).toBe(first.body.id);
    expect((await get()).onDiskReview).toMatchObject({ reviewedBy: 'brandon' });

    await unreviewDisk(item).expect(204);
    expect((await get()).onDiskReview).toBeNull();
    await unreviewDisk(item).expect(404);

    expect(await eventTypes(sourceId)).toEqual(
      expect.arrayContaining(['on_disk.reviewed', 'on_disk.unreviewed']),
    );
    expect(
      (await eventTypes(sourceId)).filter(
        (type: string) => type === 'on_disk.reviewed',
      ),
    ).toHaveLength(1);
  });

  it('only a human may review or take it back', async () => {
    const sourceId = await createSource();
    const item = await skipInJob(sourceId);
    const agent = { 'X-Actor-Type': 'openclaw', 'X-Actor-Id': 'agent' };

    await reviewDisk(item, agent).expect(409);
    await reviewDisk(item).expect(201);
    await unreviewDisk(item, agent).expect(409);
  });

  it('404s for an unknown queue item', async () => {
    const unknown = { id: '123e4567-e89b-42d3-a456-426614174000' };

    await reviewDisk(unknown as ClaimedItem).expect(404);
    await unreviewDisk(unknown as ClaimedItem).expect(404);
  });

  it('holds for a later job of the same source, and lists by path prefix', async () => {
    const sourceId = await createSource();
    const first = await skipInJob(sourceId);
    await reviewDisk(first).expect(201);

    await skipInJob(sourceId);

    const listed = async (query: Record<string, string>) =>
      (
        await getRequest()
          .get(`/sources/${sourceId}/on-disk-reviews`)
          .query(query)
          .expect(200)
      ).body as { path: string }[];
    expect(
      (await listed({ pathPrefix: DOWNLOADS })).map((r) => r.path),
    ).toEqual([DOWNLOADS]);
    expect(await listed({ pathPrefix: 'C:\\Elsewhere' })).toHaveLength(0);
  });
});

describe('unreadable child directories', () => {
  it('records them as failed at once, idempotently, and allows one human retry', async () => {
    const sourceId = await createSource();
    const job = (
      await getRequest()
        .post(`/sources/${sourceId}/discovery-jobs`)
        .send({ rootPath: 'C:\\Users' })
        .expect(201)
    ).body as { id: string };
    const item = (
      await getRequest()
        .post(`/discovery-jobs/${job.id}/queue-items/claim`)
        .send({ workerId: 'w1', leaseSeconds: 300 })
        .expect(200)
    ).body.item as ClaimedItem;
    const body = {
      claimToken: item.claimToken,
      unreadable: [
        { path: 'C:\\Users\\DefaultAppPool', error: 'EPERM on realpath' },
      ],
    };

    const first = await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send(body)
      .expect(200);
    expect(first.body.children[0]).toMatchObject({
      status: 'failed',
      attemptCount: 0,
      lastError: 'EPERM on realpath',
      created: true,
    });

    const replay = await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send(body)
      .expect(200);
    expect(replay.body.children).toHaveLength(1);

    await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send({
        claimToken: item.claimToken,
        unreadable: [{ path: 'C:\\Other\\x', error: 'EPERM' }],
      })
      .expect(409);

    await getRequest().post(`/discovery-jobs/${job.id}/complete`).expect(200);
  });

  it('lets a human retry an unreadable child while the job is active', async () => {
    const sourceId = await createSource();
    const job = (
      await getRequest()
        .post(`/sources/${sourceId}/discovery-jobs`)
        .send({ rootPath: 'C:\\Users' })
        .expect(201)
    ).body as { id: string };
    const item = (
      await getRequest()
        .post(`/discovery-jobs/${job.id}/queue-items/claim`)
        .send({ workerId: 'w1', leaseSeconds: 300 })
        .expect(200)
    ).body.item as ClaimedItem;
    const done = await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send({
        claimToken: item.claimToken,
        unreadable: [{ path: 'C:\\Users\\Svc', error: 'EPERM' }],
      })
      .expect(200);

    const retried = await getRequest()
      .post(`/queue-items/${done.body.children[0].id}/retry`)
      .expect(200);
    expect(retried.body).toMatchObject({ status: 'queued', maxAttempts: 1 });
  });
});
