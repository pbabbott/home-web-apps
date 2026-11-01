import { getRequest } from '../jest.integration.setup';
import {
  countDirectories,
  evidence,
  runSelectiveAgent,
} from './fixtures/selective-agent';
import {
  ROOT,
  type Job,
  decide,
  finish,
  listInventoryItems,
  propose,
  proposal,
  startAndClaim,
  unique,
  createRule,
  createSource,
  useInventoryCleanup,
} from './fixtures/inventory';

useInventoryCleanup();

describe('selective discovery of a fixture drive', () => {
  const runFixtureJob = async () => {
    const sourceId = await createSource();
    const job = (
      await getRequest()
        .post(`/sources/${sourceId}/discovery-jobs`)
        .send({ rootPath: 'C:\\' })
        .expect(201)
    ).body as Job;
    const run = await runSelectiveAgent(job.id);

    return { sourceId, job, run };
  };

  it('inspects selectively: no queue item per directory', async () => {
    const { job, run } = await runFixtureJob();

    const queue = await getRequest()
      .get(`/discovery-jobs/${job.id}/queue-items`)
      .expect(200);
    expect(queue.body.map((q: any) => q.path).sort()).toEqual(
      ['C:\\', 'C:\\code', 'C:\\data', 'C:\\Users', 'C:\\Users\\You'].sort(),
    );
    expect(queue.body.length).toBeLessThan(countDirectories() / 3);
    expect(run.visited).toHaveLength(5);

    // The job finishes cleanly once the dynamically created work has drained.
    const done = await getRequest()
      .post(`/discovery-jobs/${job.id}/complete`)
      .expect(200);
    expect(done.body.status).toBe('completed');
  });

  it('turns a repository into one inventory item without its internal folders', async () => {
    const { sourceId } = await runFixtureJob();
    const inventoryItems = await listInventoryItems(sourceId);

    const projectA = inventoryItems.find(
      (c) => c.rootPath === 'C:\\code\\project-a',
    )!;
    expect(projectA).toMatchObject({
      recommendation: 'back_up',
      confidence: 'high',
      decision: 'pending',
      evidence: { git: { uncommittedChanges: true } },
    });
    expect(
      inventoryItems.filter((c) =>
        c.normalizedRootPath.startsWith('c:\\code\\project-a\\'),
      ),
    ).toHaveLength(0);
    expect(inventoryItems.map((c) => c.rootPath).sort()).toEqual(
      [
        'C:\\code\\project-a',
        'C:\\code\\public-clean',
        'C:\\code\\public-unknown',
        'C:\\data\\mystery',
        'C:\\Users\\You\\Documents',
        'C:\\Users\\You\\taxes-2025.xlsx',
      ].sort(),
    );
  });

  it('represents a standalone file and a personal-data folder as inventory items', async () => {
    const { sourceId } = await runFixtureJob();
    const inventoryItems = await listInventoryItems(sourceId);

    expect(
      inventoryItems.find(
        (c) => c.rootPath === 'C:\\Users\\You\\taxes-2025.xlsx',
      ),
    ).toMatchObject({ kind: 'file', recommendation: 'back_up' });
    expect(
      inventoryItems.find((c) => c.rootPath === 'C:\\Users\\You\\Documents'),
    ).toMatchObject({ kind: 'directory', recommendation: 'back_up' });
  });

  it('skips system paths with a recorded reason and no inventory item', async () => {
    const { sourceId, job } = await runFixtureJob();
    const inventoryItems = await listInventoryItems(sourceId);
    expect(
      inventoryItems.some((c) =>
        /windows|program files|appdata/i.test(c.rootPath),
      ),
    ).toBe(false);

    const queue = await getRequest()
      .get(`/discovery-jobs/${job.id}/queue-items`)
      .expect(200);
    expect(queue.body.some((q: any) => /windows/i.test(q.path))).toBe(false);

    const root = queue.body.find((q: any) => q.path === 'C:\\');
    expect(root.result.summary).toBe('inspected C:\\');
    expect(root.result.skipped).toEqual(
      expect.arrayContaining([
        {
          path: 'C:\\Windows',
          reason: 'operating system or generated data',
        },
      ]),
    );
    // Reasons given for follow-up work are kept for the next session.
    const code = queue.body.find((q: any) => q.path === 'C:\\code');
    expect(code.reason).toBe('may contain user data');
  });

  it('records uncertainty as needs_review with explanations and evidence', async () => {
    const { sourceId } = await runFixtureJob();
    const inventoryItems = await listInventoryItems(sourceId);

    const mystery = inventoryItems.find(
      (c) => c.rootPath === 'C:\\data\\mystery',
    )!;
    expect(mystery).toMatchObject({
      recommendation: 'needs_review',
      confidence: 'low',
      recommendationReason: expect.stringContaining('unclear'),
      evidence: {
        sufficientInformation: false,
        openQuestions: expect.arrayContaining(['Is it replaceable?']),
      },
    });
  });

  it('does not treat a public remote as proof a repository is disposable', async () => {
    const { sourceId } = await runFixtureJob();
    const inventoryItems = await listInventoryItems(sourceId);

    const unknown = inventoryItems.find(
      (c) => c.rootPath === 'C:\\code\\public-unknown',
    )!;
    expect(unknown.evidence.git).toMatchObject({
      remoteVisibility: 'public',
      localStateKnown: false,
    });
    expect(unknown.recommendation).toBe('needs_review');

    // Only a known-clean, fully pushed repository is skippable.
    const clean = inventoryItems.find(
      (c) => c.rootPath === 'C:\\code\\public-clean',
    )!;
    expect(clean.recommendation).toBe('skip');
    expect(clean.evidence.git).toMatchObject({
      localStateKnown: true,
      uncommittedChanges: false,
      unpushedCommits: false,
    });
    // A skip recommendation is still just pending: nothing is auto-rejected.
    expect(clean.decision).toBe('pending');
  });
});

describe('exclusion rules', () => {
  it('rejects inventory items under exclude_subtree and on a selective_only path itself', async () => {
    const sourceId = await createSource();
    const subtree = await createRule({
      sourceId,
      path: `${ROOT}\\old`,
      scope: 'exclude_subtree',
    });
    const selective = await createRule({
      sourceId,
      path: `${ROOT}\\data`,
      scope: 'selective_only',
    });
    const { item } = await startAndClaim(sourceId);

    const blocked = await propose(item, [
      proposal(`${ROOT}\\old\\x`),
      proposal(`${ROOT}\\data`),
      proposal(`${ROOT}\\fine`),
    ]).expect(409);
    expect(blocked.body.blocked).toEqual([
      { path: 'C:\\code\\data', state: 'selective', ruleIds: [selective.id] },
      { path: 'C:\\code\\old\\x', state: 'excluded', ruleIds: [subtree.id] },
    ]);
    // All or nothing: the allowed path was not recorded either.
    expect(await listInventoryItems(sourceId)).toHaveLength(0);

    // A descendant of a selective_only path is still explorable and proposable.
    await propose(item, [proposal(`${ROOT}\\data\\child`)]).expect(200);
  });

  it('lets a global exclude_subtree win over a source rule beneath it', async () => {
    const sourceId = await createSource();
    const base = `${ROOT}\\g-${unique()}`;
    const global = await createRule({ path: base, scope: 'exclude_subtree' });
    await createRule({
      sourceId,
      path: `${base}\\sub`,
      scope: 'selective_only',
    });
    const { item } = await startAndClaim(sourceId);

    const res = await propose(item, [proposal(`${base}\\sub\\x`)]).expect(409);

    expect(res.body.blocked[0]).toMatchObject({
      state: 'excluded',
      ruleIds: [global.id],
    });
  });

  it('skips follow-up work under an exclusion rule when it is queued, and rechecks at claim', async () => {
    const sourceId = await createSource();
    await createRule({
      sourceId,
      path: `${ROOT}\\cache`,
      scope: 'exclude_subtree',
    });
    const { job, item } = await startAndClaim(sourceId);

    const done = await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send({
        claimToken: item.claimToken,
        discoveredPaths: [
          { path: `${ROOT}\\cache\\deep`, reason: 'looked interesting' },
          { path: `${ROOT}\\docs`, reason: 'documents' },
        ],
      })
      .expect(200);

    const status = Object.fromEntries(
      done.body.children.map((c: any) => [c.path, c.status]),
    );
    expect(status).toEqual({
      'C:\\code\\cache\\deep': 'skipped',
      'C:\\code\\docs': 'queued',
    });

    // A rule added after the work was queued is honored when it is claimed.
    await createRule({
      sourceId,
      path: `${ROOT}\\docs`,
      scope: 'exclude_subtree',
    });
    const next = await getRequest()
      .post(`/discovery-jobs/${job.id}/queue-items/claim`)
      .send({ workerId: 'w1', leaseSeconds: 300 })
      .expect(200);
    expect(next.body.item).toBeNull();
    expect(next.body.reason).toBe('queue_empty');
  });

  it('keeps inventory item history when a rule is added, and blocks approval', async () => {
    const sourceId = await createSource();
    const { job, item } = await startAndClaim(sourceId);
    const res = await propose(item, [proposal(`${ROOT}\\keep-me`)]).expect(200);
    const id = res.body[0].id;
    await finish(job, item);

    const rule = await createRule({
      sourceId,
      path: `${ROOT}\\keep-me`,
      scope: 'exclude_subtree',
    });

    // Nothing was deleted: the inventory item remains, now flagged by the rule.
    const detail = await getRequest().get(`/inventory-items/${id}`).expect(200);
    expect(detail.body.exclusion).toEqual({
      state: 'excluded',
      ruleIds: [rule.id],
    });
    expect(await listInventoryItems(sourceId)).toHaveLength(1);

    const blocked = await decide(id, { decision: 'approved' }).expect(409);
    expect(blocked.body.ruleIds).toEqual([rule.id]);
    // A human can still reject it.
    await decide(id, { decision: 'rejected' }).expect(200);
  });
});

describe('job completion with dynamically created work', () => {
  it('cannot complete while follow-up work is queued or in progress', async () => {
    const sourceId = await createSource();
    const { job, item } = await startAndClaim(sourceId);

    await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send({
        claimToken: item.claimToken,
        discoveredPaths: [{ path: `${ROOT}\\next`, reason: 'worth a look' }],
      })
      .expect(200);

    const blocked = await getRequest()
      .post(`/discovery-jobs/${job.id}/complete`)
      .expect(409);
    expect(blocked.body.queueCounts).toMatchObject({ queued: 1, completed: 1 });

    const next = await getRequest()
      .post(`/discovery-jobs/${job.id}/queue-items/claim`)
      .send({ workerId: 'w1', leaseSeconds: 300 })
      .expect(200);
    expect(next.body.item.reason).toBe('worth a look');
    await getRequest().post(`/discovery-jobs/${job.id}/complete`).expect(409);

    await getRequest()
      .post(`/queue-items/${next.body.item.id}/complete`)
      .send({ claimToken: next.body.item.claimToken })
      .expect(200);
    await getRequest().post(`/discovery-jobs/${job.id}/complete`).expect(200);
  });

  it('rejects skipped paths outside the claimed directory', async () => {
    const sourceId = await createSource();
    const { item } = await startAndClaim(sourceId);

    const res = await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send({
        claimToken: item.claimToken,
        skipped: [{ path: 'C:\\Windows', reason: 'system' }],
      })
      .expect(409);

    expect(res.body.paths).toEqual(['C:\\Windows']);
  });
});

describe('discovery writes only queue items and inventory items', () => {
  const ME = 'C:\\Users\\Me';

  const queueOf = async (jobId: string) =>
    (await getRequest().get(`/discovery-jobs/${jobId}/queue-items`).expect(200))
      .body as Record<string, any>[];

  it('creates a job with exactly one queue item, the root', async () => {
    const sourceId = await createSource();
    const { job } = await startAndClaim(sourceId, ME);

    expect((await queueOf(job.id)).map((q) => q.path)).toEqual([ME]);
    expect(await listInventoryItems(sourceId)).toHaveLength(0);
  });

  it('proposes a photo folder as one inventory item and queues nothing for it', async () => {
    const sourceId = await createSource();
    const { job, item } = await startAndClaim(sourceId, ME);

    await propose(item, [proposal(`${ME}\\Pictures\\Family`)]).expect(200);

    expect((await queueOf(job.id)).map((q) => q.path)).toEqual([ME]);
    expect(await listInventoryItems(sourceId)).toHaveLength(1);
  });

  it('proposes a repository as one inventory item, with nothing for its internals', async () => {
    const sourceId = await createSource();
    const { job, item } = await startAndClaim(sourceId, 'C:\\code');

    await propose(item, [proposal('C:\\code\\my-project')]).expect(200);

    expect((await listInventoryItems(sourceId)).map((c) => c.rootPath)).toEqual(
      ['C:\\code\\my-project'],
    );
    expect((await queueOf(job.id)).map((q) => q.path)).toEqual(['C:\\code']);
  });

  it('approving or rejecting changes only the decision, with only decision audit events', async () => {
    const sourceId = await createSource();
    const { job, item } = await startAndClaim(sourceId, ME);
    const res = await propose(item, [
      proposal(`${ME}\\Pictures\\Family`),
    ]).expect(200);
    const id = res.body[0].id;
    const queueBefore = await queueOf(job.id);

    await decide(id, { decision: 'approved' }).expect(200);
    await decide(id, { decision: 'rejected' }).expect(200);

    // The queue's rows are untouched; only their count by decision follows.
    const withoutDecisions = (items: Record<string, unknown>[]) =>
      items.map(({ inventoryByDecision: _, ...rest }) => rest);
    const queueAfter = await queueOf(job.id);
    expect(withoutDecisions(queueAfter)).toEqual(withoutDecisions(queueBefore));
    expect(queueAfter[0].inventoryByDecision).toEqual({
      pending: 0,
      approved: 0,
      rejected: 1,
    });
    const events = (
      await getRequest().get('/audit-events').query({ sourceId }).expect(200)
    ).body.map((e: any) => e.eventType);
    expect(events.sort()).toEqual([
      'inventory_item.created',
      'inventory_item.decision_changed',
      'inventory_item.decision_changed',
    ]);
  });

  it('lists an irrelevant generated file only in the queue item result', async () => {
    const sourceId = await createSource();
    const { job, item } = await startAndClaim(sourceId, ME);

    await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send({
        claimToken: item.claimToken,
        skipped: [{ path: `${ME}\\build\\out.tmp`, reason: 'generated' }],
      })
      .expect(200);

    expect(await listInventoryItems(sourceId)).toHaveLength(0);
    expect((await queueOf(job.id))[0].result.skipped).toEqual([
      { path: `${ME}\\build\\out.tmp`, reason: 'generated' },
    ]);
  });
});

describe('a mixed directory such as Downloads', () => {
  it('yields file items for keepers and a pattern skip for junk, never an item for the folder', async () => {
    const sourceId = await createSource();
    const downloads = 'C:\\Users\\You\\Downloads';
    const { job, item } = await startAndClaim(sourceId, downloads);

    await propose(item, [
      proposal(`${downloads}\\bank-statement-2024.pdf`, {
        kind: 'file',
        summary: 'Bank statement',
        evidence: evidence({
          contentKinds: ['personal_documents'],
          reproducible: 'no',
          estimatedSizeBytes: 120000,
        }),
      }),
      proposal(`${downloads}\\unknown-tool.zip`, {
        kind: 'file',
        recommendation: 'needs_review',
        confidence: 'low',
        evidence: evidence({
          contentKinds: ['archives'],
          sufficientInformation: false,
          openQuestions: ['What is inside the archive?'],
        }),
      }),
    ]).expect(200);

    await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send({
        claimToken: item.claimToken,
        summary: 'two keepers, installers skipped by pattern',
        skippedGroups: [
          { pattern: '*.msi', count: 212, reason: 'installers' },
          { pattern: '*.iso', count: 9, reason: 'disk images' },
        ],
      })
      .expect(200);
    await getRequest().post(`/discovery-jobs/${job.id}/complete`).expect(200);

    const items = await listInventoryItems(sourceId);
    expect(items.map((i) => [i.kind, i.rootPath])).toEqual([
      ['file', `${downloads}\\bank-statement-2024.pdf`],
      ['file', `${downloads}\\unknown-tool.zip`],
    ]);
    expect(items.every((i) => i.rootPath !== downloads)).toBe(true);

    const queue = (
      await getRequest()
        .get(`/discovery-jobs/${job.id}/queue-items`)
        .expect(200)
    ).body as { result: { skippedGroups: { pattern: string }[] } }[];
    expect(queue[0].result.skippedGroups.map((g) => g.pattern)).toEqual([
      '*.msi',
      '*.iso',
    ]);
  });
});
