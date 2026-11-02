import { getRequest } from '../jest.integration.setup';
import { evidence } from './fixtures/selective-agent';
import {
  ROOT,
  decide,
  inventoryItemEvents,
  listInventoryItems,
  listInventoryPage,
  propose,
  proposeInNewJob,
  proposal,
  startAndClaim,
  createSource,
  useInventoryCleanup,
} from './fixtures/inventory';

useInventoryCleanup();

describe('creating and retrieving inventory items', () => {
  it('creates a pending inventory item and returns it by id and in the list', async () => {
    const sourceId = await createSource();
    const { job, item } = await startAndClaim(sourceId);

    const res = await propose(item, [proposal(`${ROOT}\\Project-A`)]).expect(
      200,
    );

    expect(res.body).toEqual([
      expect.objectContaining({
        rootPath: 'C:\\code\\Project-A',
        normalizedRootPath: 'c:\\code\\project-a',
        displayName: 'Project-A',
        kind: 'directory',
        recommendation: 'back_up',
        confidence: 'high',
        recommendationReason: 'Has local work',
        decision: 'pending',
        decidedAt: null,
        firstJobId: job.id,
        lastJobId: job.id,
        recommendedBy: 'w1',
        created: true,
        changed: false,
      }),
    ]);

    const id = res.body[0].id;
    const detail = await getRequest().get(`/inventory-items/${id}`).expect(200);
    expect(detail.body).toMatchObject({
      id,
      exclusion: { state: 'none', ruleIds: [] },
      evidence: { contentKinds: ['source_code'] },
    });
    expect(await listInventoryItems(sourceId)).toHaveLength(1);
    await getRequest()
      .get('/inventory-items/123e4567-e89b-12d3-a456-426614174000')
      .expect(404);
  });

  it('filters by recommendation, decision, job and path prefix', async () => {
    const sourceId = await createSource();
    const { job, item } = await startAndClaim(sourceId);
    const res = await propose(item, [
      proposal(`${ROOT}\\a`),
      proposal(`${ROOT}\\b`, {
        recommendation: 'needs_review',
        confidence: 'low',
      }),
      proposal(`${ROOT}\\sub\\c`),
    ]).expect(200);
    const a = res.body.find((c: any) => c.rootPath.endsWith('\\a')).id;
    await decide(a, { decision: 'approved' }).expect(200);

    expect(await listInventoryItems(sourceId)).toHaveLength(3);
    expect(
      await listInventoryItems(sourceId, { recommendation: 'needs_review' }),
    ).toHaveLength(1);
    expect(
      await listInventoryItems(sourceId, { decision: 'approved' }),
    ).toEqual([expect.objectContaining({ id: a })]);
    expect(await listInventoryItems(sourceId, { jobId: job.id })).toHaveLength(
      3,
    );
    expect(
      await listInventoryItems(sourceId, { pathPrefix: `${ROOT}\\sub` }),
    ).toHaveLength(1);
    // Keyset paging by normalizedRootPath.
    const page = await listInventoryItems(sourceId, { limit: '2' });
    const rest = await listInventoryItems(sourceId, {
      after: page[1].normalizedRootPath,
    });
    expect(rest).toHaveLength(1);
  });

  it('searches, matches an exact path, filters by kind and pages with offset and a total', async () => {
    const sourceId = await createSource();
    const { item } = await startAndClaim(sourceId);
    await propose(item, [
      proposal(`${ROOT}\\photos`, { summary: 'Family pictures' }),
      proposal(`${ROOT}\\photos\\raw`),
      proposal(`${ROOT}\\100%_done`),
      proposal(`${ROOT}\\notes.txt`, { kind: 'file' }),
    ]).expect(200);

    const paths = async (query: Record<string, string>) =>
      (await listInventoryItems(sourceId, query)).map((c) => c.rootPath);

    // Case-insensitive, across path and summary.
    expect(await paths({ q: 'PHOTOS' })).toEqual([
      `${ROOT}\\photos`,
      `${ROOT}\\photos\\raw`,
    ]);
    expect(await paths({ q: 'pictures' })).toEqual([`${ROOT}\\photos`]);
    // LIKE wildcards are literal.
    expect(await paths({ q: '%_' })).toEqual([`${ROOT}\\100%_done`]);
    expect(await paths({ q: '%' })).toEqual([`${ROOT}\\100%_done`]);
    // Exact path: not the subtree.
    expect(await paths({ path: `${ROOT}\\PHOTOS` })).toEqual([
      `${ROOT}\\photos`,
    ]);
    expect(await paths({ kind: 'file' })).toEqual([`${ROOT}\\notes.txt`]);

    // Offset pages; the total ignores paging.
    const first = await listInventoryPage(sourceId, { limit: '3' });
    const second = await listInventoryPage(sourceId, {
      limit: '3',
      offset: '3',
    });
    expect([first.total, second.total]).toEqual([4, 4]);
    expect(first.items).toHaveLength(3);
    expect(second.items).toHaveLength(1);
    expect((await listInventoryPage(sourceId, { q: 'photos' })).total).toBe(2);

    await getRequest()
      .get(`/sources/${sourceId}/inventory-items`)
      .query({ offset: '1', after: 'c:\\x' })
      .expect(400);
  });

  it('refuses inventory items outside the claimed directory or from a dead claim', async () => {
    const sourceId = await createSource();
    const { item } = await startAndClaim(sourceId);

    const outside = await propose(item, [proposal('C:\\elsewhere\\x')]).expect(
      409,
    );
    expect(outside.body.paths).toEqual(['C:\\elsewhere\\x']);

    await getRequest()
      .post(`/queue-items/${item.id}/inventory-items`)
      .send({
        claimToken: '123e4567-e89b-12d3-a456-426614174000',
        inventoryItems: [proposal(`${ROOT}\\a`)],
      })
      .expect(409);
    expect(await listInventoryItems(sourceId)).toHaveLength(0);
  });
});

describe('uniqueness and rediscovery', () => {
  it('keeps one inventory item per source and normalized path', async () => {
    const sourceId = await createSource();
    const { item } = await startAndClaim(sourceId);

    const first = await propose(item, [
      proposal(`${ROOT}\\Project-A`, { displayName: 'Project A' }),
    ]).expect(200);
    // Same logical path spelled differently: case, slashes, trailing separator.
    const second = await propose(item, [
      proposal('c:/CODE/project-a/', { displayName: 'Project A' }),
    ]).expect(200);

    expect(second.body[0]).toMatchObject({
      id: first.body[0].id,
      created: false,
      changed: false,
    });
    expect(await listInventoryItems(sourceId)).toHaveLength(1);
  });

  it('updates evidence and recommendation on rediscovery by another job', async () => {
    const sourceId = await createSource();
    const path = `${ROOT}\\project-a`;
    const first = await proposeInNewJob(sourceId, path, {
      recommendation: 'needs_review',
      confidence: 'low',
      reason: 'unknown local state',
    });

    const { job: job2, inventoryItem } = await proposeInNewJob(sourceId, path, {
      recommendation: 'back_up',
      confidence: 'high',
      reason: 'uncommitted changes found',
      evidence: evidence({
        contentKinds: ['source_code'],
        observations: ['git status shows modified files'],
      }),
    });

    expect(inventoryItem).toMatchObject({
      id: first.inventoryItem.id,
      created: false,
      changed: true,
      recommendation: 'back_up',
      confidence: 'high',
      recommendationReason: 'uncommitted changes found',
      firstJobId: first.job.id,
      lastJobId: job2.id,
    });
    expect(inventoryItem.evidence.observations).toEqual([
      'git status shows modified files',
    ]);
    expect(
      new Date(inventoryItem.recommendedAt).getTime(),
    ).toBeGreaterThanOrEqual(
      new Date(first.inventoryItem.recommendedAt).getTime(),
    );
    expect(new Date(inventoryItem.createdAt)).toEqual(
      new Date(first.inventoryItem.createdAt),
    );
    expect(await listInventoryItems(sourceId)).toHaveLength(1);

    const events = await inventoryItemEvents(first.inventoryItem.id);
    expect(events.map((e) => e.eventType).sort()).toEqual([
      'inventory_item.created',
      'inventory_item.recommendation_changed',
    ]);
    const changed = events.find(
      (e) => e.eventType === 'inventory_item.recommendation_changed',
    )!;
    expect(changed.actorType).toBe('openclaw');
    expect(changed.details).toMatchObject({
      from: { recommendation: 'needs_review', confidence: 'low' },
      to: { recommendation: 'back_up', confidence: 'high' },
      decision: 'pending',
    });
  });

  it('preserves an existing human decision on rediscovery', async () => {
    const sourceId = await createSource();
    const path = `${ROOT}\\project-a`;
    const { inventoryItem } = await proposeInNewJob(sourceId, path);
    const approved = await decide(inventoryItem.id, {
      decision: 'approved',
      note: 'keep',
    }).expect(200);

    const again = await proposeInNewJob(sourceId, path, {
      recommendation: 'skip',
      confidence: 'high',
      reason: 'now looks reproducible',
      evidence: evidence({ reproducible: 'yes' }),
    });

    expect(again.inventoryItem).toMatchObject({
      id: inventoryItem.id,
      recommendation: 'skip',
      decision: 'approved',
      decisionNote: 'keep',
      decidedBy: 'brandon',
    });
    expect(again.inventoryItem.decidedAt).toBe(approved.body.decidedAt);
    // The audit trail says a decision was already in place when it changed.
    const events = await inventoryItemEvents(inventoryItem.id);
    expect(
      events.find(
        (e) => e.eventType === 'inventory_item.recommendation_changed',
      )!.details.decision,
    ).toBe('approved');
  });

  it('writes no audit events for no-op re-proposals or repeated decisions', async () => {
    const sourceId = await createSource();
    const path = `${ROOT}\\project-a`;
    const { inventoryItem } = await proposeInNewJob(sourceId, path);
    await proposeInNewJob(sourceId, path);
    await proposeInNewJob(sourceId, path);

    expect(await inventoryItemEvents(inventoryItem.id)).toHaveLength(1);

    await decide(inventoryItem.id, { decision: 'approved' }).expect(200);
    await decide(inventoryItem.id, { decision: 'approved' }).expect(200);
    expect(await inventoryItemEvents(inventoryItem.id)).toHaveLength(2);
  });
});

describe('agent recommendations versus human decisions', () => {
  it('cannot approve or reject: a decision in the proposal is ignored', async () => {
    const sourceId = await createSource();
    const { item } = await startAndClaim(sourceId);

    const res = await propose(item, [
      proposal(`${ROOT}\\a`, { decision: 'approved', decidedBy: 'agent' }),
    ]).expect(200);

    expect(res.body[0]).toMatchObject({
      decision: 'pending',
      decidedAt: null,
      decidedBy: null,
    });
  });

  it('refuses a decision from a non-human actor', async () => {
    const sourceId = await createSource();
    const { inventoryItem } = await proposeInNewJob(sourceId, `${ROOT}\\a`);

    await decide(
      inventoryItem.id,
      { decision: 'approved' },
      {
        'X-Actor-Type': 'openclaw',
        'X-Actor-Id': 'w1',
      },
    ).expect(409);
    await decide(
      inventoryItem.id,
      { decision: 'rejected' },
      {
        'X-Actor-Type': 'system',
      },
    ).expect(409);

    const detail = await getRequest()
      .get(`/inventory-items/${inventoryItem.id}`)
      .expect(200);
    expect(detail.body.decision).toBe('pending');
  });

  it('persists approval and rejection with audit events, and allows changing it', async () => {
    const sourceId = await createSource();
    const { inventoryItem } = await proposeInNewJob(sourceId, `${ROOT}\\a`);

    const approved = await decide(inventoryItem.id, {
      decision: 'approved',
      note: 'tax records',
    }).expect(200);
    expect(approved.body).toMatchObject({
      decision: 'approved',
      decisionNote: 'tax records',
      decidedBy: 'brandon',
    });
    expect(approved.body.decidedAt).not.toBeNull();

    // An omitted note is kept for a repeat and cleared when the decision changes.
    const rejected = await decide(inventoryItem.id, {
      decision: 'rejected',
    }).expect(200);
    expect(rejected.body).toMatchObject({
      decision: 'rejected',
      decisionNote: null,
    });
    const reset = await decide(inventoryItem.id, {
      decision: 'pending',
    }).expect(200);
    expect(reset.body).toMatchObject({
      decision: 'pending',
      decidedAt: null,
      decidedBy: null,
    });

    const decisions = (await inventoryItemEvents(inventoryItem.id)).filter(
      (e) => e.eventType === 'inventory_item.decision_changed',
    );
    expect(decisions.map((e) => [e.details.from, e.details.to])).toEqual([
      ['rejected', 'pending'],
      ['approved', 'rejected'],
      ['pending', 'approved'],
    ]);
    expect(decisions[2]).toMatchObject({
      actorType: 'human',
      actorId: 'brandon',
      details: { note: 'tax records', path: 'C:\\code\\a' },
    });

    await decide(inventoryItem.id, { decision: 'maybe' }).expect(400);
    await getRequest()
      .patch('/inventory-items/123e4567-e89b-12d3-a456-426614174000/decision')
      .send({ decision: 'approved' })
      .expect(404);
  });

  it('guards the proposal API: low-confidence skip and unverified repos are 400', async () => {
    const sourceId = await createSource();
    const { item } = await startAndClaim(sourceId);
    const git = {
      remoteUrl: 'https://github.com/someone/x',
      remoteVisibility: 'public',
      localStateKnown: false,
      uncommittedChanges: null,
      untrackedFiles: null,
      unpushedCommits: null,
      ignoredFilesOfNote: null,
    };

    await propose(item, [
      proposal(`${ROOT}\\x`, { recommendation: 'skip', confidence: 'low' }),
    ]).expect(400);
    await propose(item, [
      proposal(`${ROOT}\\x`, {
        recommendation: 'skip',
        confidence: 'high',
        evidence: evidence({ git }),
      }),
    ]).expect(400);
    expect(await listInventoryItems(sourceId)).toHaveLength(0);

    // The same repository is acceptable as needs_review.
    await propose(item, [
      proposal(`${ROOT}\\x`, {
        recommendation: 'needs_review',
        confidence: 'low',
        evidence: evidence({
          git,
          sufficientInformation: false,
          openQuestions: ['Run git status'],
        }),
      }),
    ]).expect(200);
  });
});
