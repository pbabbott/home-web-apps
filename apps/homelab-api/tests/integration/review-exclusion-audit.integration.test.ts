import { db } from '../../src/db';
import { getRequest } from '../jest.integration.setup';

// Runs against the real local dev Postgres, so everything created here is
// deleted afterwards. Sources cascade to jobs, queue items, inventory and
// source-level rules; global rules and the audit log (which has no foreign
// keys by design) are removed explicitly.
const createdSourceIds: string[] = [];
const createdHostIds: string[] = [];
const createdRuleIds: string[] = [];

afterEach(async () => {
  await db.$client.query(
    'delete from audit_events where source_id = any($1) or exclusion_rule_id = any($2)',
    [createdSourceIds, createdRuleIds],
  );
  await db.$client.query('delete from exclusion_rules where id = any($1)', [
    createdRuleIds,
  ]);
  await db.$client.query('delete from sources where id = any($1)', [
    createdSourceIds,
  ]);
  await db.$client.query('delete from hosts where id = any($1)', [
    createdHostIds,
  ]);
  createdSourceIds.length = 0;
  createdHostIds.length = 0;
  createdRuleIds.length = 0;
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

type Rule = { id: string; sourceId: string | null };

const createRule = async (body: {
  sourceId?: string | null;
  path: string;
  scope: 'selective_only' | 'exclude_subtree';
  reason?: string;
}): Promise<Rule> => {
  const res = await getRequest()
    .post('/exclusion-rules')
    .send(body)
    .expect(201);
  createdRuleIds.push(res.body.id);

  return res.body;
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

const recordFiles = (
  item: ClaimedItem,
  items: { path: string; itemType: 'file' | 'directory'; sizeBytes?: number }[],
) =>
  getRequest()
    .post(`/queue-items/${item.id}/inventory-items`)
    .send({ claimToken: item.claimToken, items })
    .expect(200);

/** Runs a job over ROOT that records `items`, and returns them by path. */
const discover = async (
  sourceId: string,
  items: { path: string; itemType: 'file' | 'directory'; sizeBytes?: number }[],
) => {
  const job = await startJob(sourceId);
  const root = await claimItem(job.id);
  await recordFiles(root, items);
  await getRequest()
    .post(`/queue-items/${root.id}/complete`)
    .send({ claimToken: root.claimToken, discoveredPaths: [] })
    .expect(200);

  const listed = await getRequest()
    .get(`/sources/${sourceId}/inventory-items`)
    .expect(200);
  const byPath = new Map<string, { id: string; [key: string]: unknown }>(
    listed.body.map((i: { path: string; id: string }) => [i.path, i]),
  );

  return { job, byPath };
};

const review = (
  id: string,
  body: object,
  headers: Record<string, string> = {},
) =>
  getRequest().patch(`/inventory-items/${id}/review`).set(headers).send(body);

const auditEvents = async (query: Record<string, string | number> = {}) =>
  (await getRequest().get('/audit-events').query(query).expect(200)).body as {
    id: string;
    eventType: string;
    actorType: string;
    actorId: string | null;
    sourceId: string | null;
    jobId: string | null;
    inventoryItemId: string | null;
    exclusionRuleId: string | null;
    details: Record<string, any>;
    createdAt: string;
  }[];

describe('exclusion rules', () => {
  it('creates, lists, updates and deletes a rule', async () => {
    const sourceId = await createSource();
    const rule = await createRule({
      sourceId,
      path: 'c:/users/you/Projects/old-client/',
      scope: 'exclude_subtree',
      reason: 'abandoned',
    });

    const listed = await getRequest()
      .get('/exclusion-rules')
      .query({ sourceId })
      .expect(200);
    expect(listed.body).toEqual([
      expect.objectContaining({
        id: rule.id,
        path: 'C:\\users\\you\\Projects\\old-client',
        normalizedPath: 'c:\\users\\you\\projects\\old-client',
        scope: 'exclude_subtree',
        reason: 'abandoned',
      }),
    ]);

    const updated = await getRequest()
      .patch(`/exclusion-rules/${rule.id}`)
      .send({ scope: 'selective_only', reason: null })
      .expect(200);
    expect(updated.body).toMatchObject({
      scope: 'selective_only',
      reason: null,
    });

    await getRequest().delete(`/exclusion-rules/${rule.id}`).expect(204);
    await getRequest().delete(`/exclusion-rules/${rule.id}`).expect(404);
    await getRequest()
      .patch(`/exclusion-rules/${rule.id}`)
      .send({ reason: 'x' })
      .expect(404);
  });

  it('matches paths case-insensitively when rejecting duplicates', async () => {
    const sourceId = await createSource();
    await createRule({
      sourceId,
      path: 'C:\\Data\\Cache',
      scope: 'exclude_subtree',
    });

    await getRequest()
      .post('/exclusion-rules')
      .send({ sourceId, path: 'c:\\DATA\\cache', scope: 'selective_only' })
      .expect(409);
  });

  it('refuses a source rule on a path that has a global rule, and the reverse', async () => {
    const sourceId = await createSource();
    const globalPath = `C:\\Users\\You\\global-${unique()}`;
    const sourcePath = `C:\\Users\\You\\source-${unique()}`;

    await createRule({ path: globalPath, scope: 'exclude_subtree' });
    await getRequest()
      .post('/exclusion-rules')
      .send({ sourceId, path: globalPath, scope: 'selective_only' })
      .expect(409);

    await createRule({ sourceId, path: sourcePath, scope: 'selective_only' });
    await getRequest()
      .post('/exclusion-rules')
      .send({ path: sourcePath, scope: 'exclude_subtree' })
      .expect(409);
  });

  it('allows the same path for different sources', async () => {
    const [a, b] = [await createSource(), await createSource()];
    const path = `C:\\Users\\You\\shared-${unique()}`;

    await createRule({ sourceId: a, path, scope: 'exclude_subtree' });
    await createRule({ sourceId: b, path, scope: 'exclude_subtree' });
  });

  it('404s for an unknown source', async () => {
    await getRequest()
      .post('/exclusion-rules')
      .send({
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        path: 'C:\\x',
        scope: 'exclude_subtree',
      })
      .expect(404);
  });

  it('lists a source’s rules together with the global ones', async () => {
    const [a, b] = [await createSource(), await createSource()];
    const globalRule = await createRule({
      path: `C:\\Users\\You\\g-${unique()}`,
      scope: 'exclude_subtree',
    });
    const ruleA = await createRule({
      sourceId: a,
      path: `C:\\Users\\You\\a-${unique()}`,
      scope: 'selective_only',
    });
    const ruleB = await createRule({
      sourceId: b,
      path: `C:\\Users\\You\\b-${unique()}`,
      scope: 'selective_only',
    });

    const ids = (
      await getRequest()
        .get('/exclusion-rules')
        .query({ sourceId: a })
        .expect(200)
    ).body.map((r: Rule) => r.id);

    expect(ids).toEqual(expect.arrayContaining([globalRule.id, ruleA.id]));
    expect(ids).not.toContain(ruleB.id);
  });
});

describe('exclusion precedence', () => {
  it('lets a global exclude_subtree win over a source rule beneath it', async () => {
    const sourceId = await createSource();
    const base = `C:\\Users\\You\\win-${unique()}`;
    const globalRule = await createRule({
      path: base,
      scope: 'exclude_subtree',
    });
    await createRule({
      sourceId,
      path: `${base}\\Temp`,
      scope: 'selective_only',
    });

    const { byPath } = await discover(sourceId, [
      { path: `${base}\\Temp\\a.tmp`, itemType: 'file' },
      { path: `${base}other\\b.txt`, itemType: 'file' },
    ]);

    const excluded = await getRequest()
      .get(`/inventory-items/${byPath.get(`${base}\\Temp\\a.tmp`)!.id}`)
      .expect(200);
    expect(excluded.body.exclusion).toEqual({
      state: 'excluded',
      ruleIds: [globalRule.id],
    });

    // `win-x` is not a directory-boundary prefix of `win-xother`.
    const sibling = await getRequest()
      .get(`/inventory-items/${byPath.get(`${base}other\\b.txt`)!.id}`)
      .expect(200);
    expect(sibling.body.exclusion).toEqual({ state: 'none', ruleIds: [] });
  });

  it('treats selective_only as "not a candidate itself, but explore beneath it"', async () => {
    const sourceId = await createSource();
    const nodeModules = `${ROOT}\\node_modules`;
    await createRule({ sourceId, path: nodeModules, scope: 'selective_only' });

    const { byPath } = await discover(sourceId, [
      { path: nodeModules, itemType: 'directory' },
      { path: `${nodeModules}\\notes.md`, itemType: 'file' },
    ]);

    const dir = byPath.get(nodeModules)!;
    const file = byPath.get(`${nodeModules}\\notes.md`)!;

    const detail = await getRequest()
      .get(`/inventory-items/${dir.id}`)
      .expect(200);
    expect(detail.body.exclusion.state).toBe('selective');

    await review(dir.id, { disposition: 'candidate' }).expect(409);
    await review(file.id, { disposition: 'candidate' }).expect(200);
  });

  it('blocks candidate on excluded items but still allows rejecting them', async () => {
    const sourceId = await createSource();
    const dirPath = `${ROOT}\\old-client`;
    const rule = await createRule({
      sourceId,
      path: dirPath,
      scope: 'exclude_subtree',
    });
    const { byPath } = await discover(sourceId, [
      { path: `${dirPath}\\main.ts`, itemType: 'file' },
    ]);
    const item = byPath.get(`${dirPath}\\main.ts`)!;

    const blocked = await review(item.id, { disposition: 'candidate' }).expect(
      409,
    );
    expect(blocked.body.blocked).toEqual([
      { id: item.id, state: 'excluded', ruleIds: [rule.id] },
    ]);

    await review(item.id, { disposition: 'not_needed' }).expect(200);
  });

  it('does not delete inventory when a rule is created', async () => {
    const sourceId = await createSource();
    const dirPath = `${ROOT}\\cache`;
    const { byPath } = await discover(sourceId, [
      { path: `${dirPath}\\x.bin`, itemType: 'file' },
    ]);

    await createRule({ sourceId, path: dirPath, scope: 'exclude_subtree' });

    await getRequest()
      .get(`/inventory-items/${byPath.get(`${dirPath}\\x.bin`)!.id}`)
      .expect(200);
  });
});

describe('exclusion enforcement at claim time', () => {
  it('skips an already-queued directory once its subtree is excluded', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const root = await claimItem(job.id);

    await getRequest()
      .post(`/queue-items/${root.id}/complete`)
      .send({
        claimToken: root.claimToken,
        discoveredPaths: [
          `${ROOT}\\old-client`,
          `${ROOT}\\old-client\\src`,
          `${ROOT}\\old-clientele`,
          `${ROOT}\\keep`,
        ],
      })
      .expect(200);

    const rule = await createRule({
      sourceId,
      path: `${ROOT}\\OLD-CLIENT`,
      scope: 'exclude_subtree',
    });

    const claimed = [
      (await claimItem(job.id)).path,
      (await claimItem(job.id)).path,
    ];
    expect(claimed.sort()).toEqual([`${ROOT}\\keep`, `${ROOT}\\old-clientele`]);

    const idle = await claim(job.id);
    expect(idle.body).toMatchObject({ item: null });

    const queue = await getRequest()
      .get(`/discovery-jobs/${job.id}/queue-items`)
      .query({ status: 'skipped' })
      .expect(200);
    expect(queue.body.map((i: { path: string }) => i.path).sort()).toEqual([
      `${ROOT}\\old-client`,
      `${ROOT}\\old-client\\src`,
    ]);
    expect(queue.body[0].lastError).toContain('excluded by rule');

    const events = await auditEvents({
      jobId: job.id,
      eventType: 'queue_items.excluded',
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorType: 'system', sourceId });
    expect(events[0].details).toMatchObject({
      count: 2,
      ruleIds: [rule.id],
      truncated: false,
    });
  });

  it('enforces a global rule for every source', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const root = await claimItem(job.id);
    const banned = `${ROOT}\\global-${unique()}`;

    await getRequest()
      .post(`/queue-items/${root.id}/complete`)
      .send({
        claimToken: root.claimToken,
        discoveredPaths: [banned, `${ROOT}\\fine`],
      })
      .expect(200);
    await createRule({ path: banned, scope: 'exclude_subtree' });

    expect((await claimItem(job.id)).path).toBe(`${ROOT}\\fine`);
    expect((await claim(job.id)).body.item).toBeNull();
  });

  it('does not skip directories under a selective_only rule', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const root = await claimItem(job.id);

    await getRequest()
      .post(`/queue-items/${root.id}/complete`)
      .send({
        claimToken: root.claimToken,
        discoveredPaths: [`${ROOT}\\node_modules`],
      })
      .expect(200);
    await createRule({
      sourceId,
      path: `${ROOT}\\node_modules`,
      scope: 'selective_only',
    });

    expect((await claimItem(job.id)).path).toBe(`${ROOT}\\node_modules`);
  });

  it('stops skipping once the rule is removed', async () => {
    const sourceId = await createSource();
    const job = await startJob(sourceId);
    const root = await claimItem(job.id);
    const dir = `${ROOT}\\temp-rule-${unique()}`;

    await getRequest()
      .post(`/queue-items/${root.id}/complete`)
      .send({ claimToken: root.claimToken, discoveredPaths: [dir] })
      .expect(200);
    const rule = await createRule({
      sourceId,
      path: dir,
      scope: 'exclude_subtree',
    });
    await getRequest().delete(`/exclusion-rules/${rule.id}`).expect(204);

    expect((await claimItem(job.id)).path).toBe(dir);
  });
});

describe('review', () => {
  it('sets a disposition with a note, an actor and a timestamp', async () => {
    const sourceId = await createSource();
    const { byPath } = await discover(sourceId, [
      {
        path: `${ROOT}\\Documents\\taxes.pdf`,
        itemType: 'file',
        sizeBytes: 10,
      },
    ]);
    const item = byPath.get(`${ROOT}\\Documents\\taxes.pdf`)!;
    expect(item.reviewDisposition).toBe('needs_review');

    const res = await review(
      item.id,
      { disposition: 'candidate', note: 'tax records' },
      { 'X-Actor-Id': 'brandon' },
    ).expect(200);

    expect(res.body).toMatchObject({
      reviewDisposition: 'candidate',
      reviewNote: 'tax records',
      reviewedBy: 'brandon',
    });
    expect(res.body.reviewedAt).toEqual(expect.any(String));

    const events = await auditEvents({ inventoryItemId: item.id });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: 'inventory_item.review_changed',
      actorType: 'human',
      actorId: 'brandon',
      sourceId,
      inventoryItemId: item.id,
      details: { from: 'needs_review', to: 'candidate', note: 'tax records' },
    });
  });

  it('keeps the note on a repeat and clears it when the decision changes', async () => {
    const sourceId = await createSource();
    const { byPath } = await discover(sourceId, [
      { path: `${ROOT}\\a.txt`, itemType: 'file' },
    ]);
    const { id } = byPath.get(`${ROOT}\\a.txt`)!;

    await review(id, { disposition: 'candidate', note: 'keep' }).expect(200);
    const same = await review(id, { disposition: 'candidate' }).expect(200);
    expect(same.body.reviewNote).toBe('keep');
    expect(await auditEvents({ inventoryItemId: id })).toHaveLength(1);

    const changed = await review(id, { disposition: 'not_needed' }).expect(200);
    expect(changed.body.reviewNote).toBeNull();
    expect(await auditEvents({ inventoryItemId: id })).toHaveLength(2);
  });

  it('404s for a missing item and 400s for a bad disposition without auditing', async () => {
    const sourceId = await createSource();
    const { byPath } = await discover(sourceId, [
      { path: `${ROOT}\\a.txt`, itemType: 'file' },
    ]);
    const { id } = byPath.get(`${ROOT}\\a.txt`)!;

    await review('123e4567-e89b-12d3-a456-426614174000', {
      disposition: 'candidate',
    }).expect(404);
    await review(id, { disposition: 'maybe' }).expect(400);
    await review(
      id,
      { disposition: 'candidate' },
      { 'X-Actor-Type': 'robot' },
    ).expect(400);

    expect(await auditEvents({ sourceId })).toHaveLength(0);
    const after = await getRequest().get(`/inventory-items/${id}`).expect(200);
    expect(after.body.reviewDisposition).toBe('needs_review');
  });

  it('survives rediscovery: filesystem facts refresh, the decision does not reset', async () => {
    const sourceId = await createSource();
    const taxes = `${ROOT}\\Documents\\taxes.pdf`;
    const first = await discover(sourceId, [
      { path: taxes, itemType: 'file', sizeBytes: 100 },
    ]);
    const { id } = first.byPath.get(taxes)!;
    await review(id, { disposition: 'candidate', note: 'keep' }).expect(200);

    // A later job finds the file again with new metadata.
    await getRequest()
      .post(`/discovery-jobs/${first.job.id}/complete`)
      .expect(200);
    const second = await startJob(sourceId);
    const root = await claimItem(second.id);
    const res = await recordFiles(root, [
      { path: taxes.toUpperCase(), itemType: 'file', sizeBytes: 250 },
    ]);

    expect(res.body[0]).toMatchObject({
      id,
      created: false,
      sizeBytes: 250,
      reviewDisposition: 'candidate',
      reviewNote: 'keep',
    });
    const detail = await getRequest().get(`/inventory-items/${id}`).expect(200);
    expect(detail.body).toMatchObject({
      reviewDisposition: 'candidate',
      sizeBytes: 250,
      lastJobId: second.id,
    });
  });

  it('never changes queue-item status', async () => {
    const sourceId = await createSource();
    const { job, byPath } = await discover(sourceId, [
      { path: `${ROOT}\\a.txt`, itemType: 'file' },
    ]);
    const snapshot = async () =>
      (
        await getRequest()
          .get(`/discovery-jobs/${job.id}/queue-items`)
          .expect(200)
      ).body;
    const before = await snapshot();

    await review(byPath.get(`${ROOT}\\a.txt`)!.id, {
      disposition: 'not_needed',
    }).expect(200);

    expect(await snapshot()).toEqual(before);
  });

  it('filters the inventory list by review disposition', async () => {
    const sourceId = await createSource();
    const { byPath } = await discover(sourceId, [
      { path: `${ROOT}\\a.txt`, itemType: 'file' },
      { path: `${ROOT}\\b.txt`, itemType: 'file' },
    ]);
    await review(byPath.get(`${ROOT}\\a.txt`)!.id, {
      disposition: 'candidate',
    }).expect(200);

    const list = async (reviewDisposition: string) =>
      (
        await getRequest()
          .get(`/sources/${sourceId}/inventory-items`)
          .query({ reviewDisposition })
          .expect(200)
      ).body.map((i: { path: string }) => i.path);

    expect(await list('candidate')).toEqual([`${ROOT}\\a.txt`]);
    // The job's root directory is recorded too, and also awaits review.
    expect(await list('needs_review')).toEqual([ROOT, `${ROOT}\\b.txt`]);
    expect(await list('not_needed')).toEqual([]);
  });
});

describe('bulk review', () => {
  const forty = Array.from({ length: 40 }, (_, i) => ({
    path: `${ROOT}\\photos\\img-${String(i).padStart(2, '0')}.jpg`,
    itemType: 'file' as const,
  }));

  it('applies one decision to 40 items with a single bounded audit event', async () => {
    const sourceId = await createSource();
    const { byPath } = await discover(sourceId, forty);
    const ids = forty.map((f) => byPath.get(f.path)!.id);

    const res = await getRequest()
      .post('/inventory-items/review')
      .set('X-Actor-Id', 'brandon')
      .send({ ids, disposition: 'candidate' })
      .expect(200);

    expect(res.body).toMatchObject({ changedCount: 40, unchangedCount: 0 });
    expect(
      res.body.items.every(
        (i: { reviewDisposition: string }) =>
          i.reviewDisposition === 'candidate',
      ),
    ).toBe(true);

    const events = await auditEvents({
      eventType: 'inventory_item.review_bulk_changed',
      sourceId,
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: 'brandon', sourceId });
    expect(events[0].details).toMatchObject({
      disposition: 'candidate',
      requestedCount: 40,
      unchangedCount: 0,
    });
    expect(events[0].details.changed).toHaveLength(40);
    expect(events[0].details.changed[0]).toEqual({
      id: expect.any(String),
      from: 'needs_review',
    });

    // Any one of the items finds the bulk event by inventoryItemId.
    expect(await auditEvents({ inventoryItemId: ids[7] })).toHaveLength(1);

    // Repeating changes nothing and records nothing more.
    const again = await getRequest()
      .post('/inventory-items/review')
      .send({ ids, disposition: 'candidate' })
      .expect(200);
    expect(again.body).toMatchObject({ changedCount: 0, unchangedCount: 40 });
    expect(await auditEvents({ sourceId })).toHaveLength(1);
  });

  it('is all or nothing when an id is missing', async () => {
    const sourceId = await createSource();
    const { byPath } = await discover(sourceId, forty.slice(0, 3));
    const ids = forty.slice(0, 3).map((f) => byPath.get(f.path)!.id);
    const missing = '123e4567-e89b-12d3-a456-426614174000';

    const res = await getRequest()
      .post('/inventory-items/review')
      .send({ ids: [...ids, missing], disposition: 'not_needed' })
      .expect(404);

    expect(res.body.missingIds).toEqual([missing]);
    for (const id of ids) {
      const item = await getRequest().get(`/inventory-items/${id}`).expect(200);
      expect(item.body.reviewDisposition).toBe('needs_review');
    }
    expect(await auditEvents({ sourceId })).toHaveLength(0);
  });

  it('is all or nothing when one item may not be a candidate', async () => {
    const sourceId = await createSource();
    const bad = `${ROOT}\\blocked`;
    const rule = await createRule({
      sourceId,
      path: bad,
      scope: 'exclude_subtree',
    });
    const { byPath } = await discover(sourceId, [
      { path: `${ROOT}\\ok.txt`, itemType: 'file' },
      { path: `${bad}\\no.txt`, itemType: 'file' },
    ]);
    const ok = byPath.get(`${ROOT}\\ok.txt`)!.id;
    const no = byPath.get(`${bad}\\no.txt`)!.id;

    const res = await getRequest()
      .post('/inventory-items/review')
      .send({ ids: [ok, no], disposition: 'candidate' })
      .expect(409);

    expect(res.body.blocked).toEqual([
      { id: no, state: 'excluded', ruleIds: [rule.id] },
    ]);
    const item = await getRequest().get(`/inventory-items/${ok}`).expect(200);
    expect(item.body.reviewDisposition).toBe('needs_review');
    expect(
      await auditEvents({
        sourceId,
        eventType: 'inventory_item.review_bulk_changed',
      }),
    ).toHaveLength(0);
  });
});

describe('audit events', () => {
  it('records rule creation, update and removal, and keeps the removal', async () => {
    const sourceId = await createSource();
    const rule = await createRule({
      sourceId,
      path: `${ROOT}\\dist`,
      scope: 'selective_only',
      reason: 'build output',
    });
    await getRequest()
      .patch(`/exclusion-rules/${rule.id}`)
      .set({ 'X-Actor-Type': 'openclaw', 'X-Actor-Id': 'cron-1' })
      .send({ scope: 'exclude_subtree' })
      .expect(200);
    await getRequest().delete(`/exclusion-rules/${rule.id}`).expect(204);

    const events = await auditEvents({ exclusionRuleId: rule.id });
    expect(events.map((e) => e.eventType)).toEqual([
      'exclusion_rule.deleted',
      'exclusion_rule.updated',
      'exclusion_rule.created',
    ]);
    expect(events[0].details).toMatchObject({
      path: `${ROOT}\\dist`,
      scope: 'exclude_subtree',
      global: false,
    });
    expect(events[1]).toMatchObject({
      actorType: 'openclaw',
      actorId: 'cron-1',
    });
    expect(events[1].details).toMatchObject({
      before: { scope: 'selective_only' },
      after: { scope: 'exclude_subtree' },
    });
    expect(events[2].details).toMatchObject({ reason: 'build output' });
  });

  it('writes nothing for a rejected rule request or a no-op update', async () => {
    const sourceId = await createSource();
    const rule = await createRule({
      sourceId,
      path: `${ROOT}\\dist`,
      scope: 'exclude_subtree',
    });

    await getRequest()
      .post('/exclusion-rules')
      .send({ sourceId, path: `${ROOT}\\dist`, scope: 'selective_only' })
      .expect(409);
    await getRequest()
      .post('/exclusion-rules')
      .send({ sourceId, path: `${ROOT}\\other`, scope: 'bogus' })
      .expect(400);
    await getRequest()
      .patch(`/exclusion-rules/${rule.id}`)
      .send({ scope: 'exclude_subtree' })
      .expect(200);

    expect(await auditEvents({ sourceId })).toHaveLength(1);
  });

  it('filters by source, job, event type and time range', async () => {
    const [a, b] = [await createSource(), await createSource()];
    await createRule({
      sourceId: a,
      path: `${ROOT}\\a`,
      scope: 'selective_only',
    });
    await createRule({
      sourceId: b,
      path: `${ROOT}\\b`,
      scope: 'selective_only',
    });

    const job = await startJob(a);
    const root = await claimItem(job.id);
    await getRequest()
      .post(`/queue-items/${root.id}/complete`)
      .send({
        claimToken: root.claimToken,
        discoveredPaths: [`${ROOT}\\skipme`],
      })
      .expect(200);
    await createRule({
      sourceId: a,
      path: `${ROOT}\\skipme`,
      scope: 'exclude_subtree',
    });
    expect((await claim(job.id)).body.item).toBeNull();

    expect((await auditEvents({ sourceId: a })).length).toBe(3);
    expect((await auditEvents({ sourceId: b })).length).toBe(1);
    expect(
      (await auditEvents({ sourceId: a, eventType: 'exclusion_rule.created' }))
        .length,
    ).toBe(2);
    expect(
      (await auditEvents({ jobId: job.id })).map((e) => e.eventType),
    ).toEqual(['queue_items.excluded']);

    const now = Date.now();
    const hour = 3_600_000;
    const within = {
      sourceId: a,
      since: new Date(now - hour).toISOString(),
      until: new Date(now + hour).toISOString(),
    };
    expect((await auditEvents(within)).length).toBe(3);
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
    const rules: Rule[] = [];
    for (let i = 0; i < 5; i++) {
      rules.push(
        await createRule({
          sourceId,
          path: `${ROOT}\\p${i}`,
          scope: 'selective_only',
        }),
      );
    }

    const all = await auditEvents({ sourceId });
    expect(all.map((e) => e.exclusionRuleId)).toEqual(
      rules.map((r) => r.id).reverse(),
    );

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
