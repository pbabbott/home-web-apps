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
