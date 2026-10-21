import { db } from '../../src/db';
import { getRequest } from '../jest.integration.setup';
import {
  countDirectories,
  evidence,
  runSelectiveAgent,
  type ClaimedItem,
} from './fixtures/selective-agent';

// Runs against the real local dev Postgres, so everything created here is
// deleted afterwards. Sources cascade to jobs, queue items,
// candidates and source-level rules; global rules and the audit log (which has
// no foreign keys by design) are removed explicitly.
const createdSourceIds: string[] = [];
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
  createdSourceIds.length = 0;
  createdRuleIds.length = 0;
});

const unique = () => Math.random().toString(36).slice(2);
const ROOT = 'C:\\code';

const createSource = async (): Promise<string> => {
  const res = await getRequest()
    .post('/sources')
    .send({ name: `exodus-cand-${unique()}` })
    .expect(201);
  createdSourceIds.push(res.body.id);

  return res.body.id;
};

const createRule = async (body: {
  sourceId?: string | null;
  path: string;
  scope: 'selective_only' | 'exclude_subtree';
}) => {
  const res = await getRequest()
    .post('/exclusion-rules')
    .send(body)
    .expect(201);
  createdRuleIds.push(res.body.id);

  return res.body as { id: string };
};

type Job = { id: string };

/** Starts a job and claims its root directory. */
const startAndClaim = async (sourceId: string, rootPath = ROOT) => {
  const job = (
    await getRequest()
      .post(`/sources/${sourceId}/discovery-jobs`)
      .send({ rootPath })
      .expect(201)
  ).body as Job;
  const res = await getRequest()
    .post(`/discovery-jobs/${job.id}/queue-items/claim`)
    .send({ workerId: 'w1', leaseSeconds: 300 })
    .expect(200);

  return { job, item: res.body.item as ClaimedItem };
};

const finish = async (job: Job, item: ClaimedItem) => {
  await getRequest()
    .post(`/queue-items/${item.id}/complete`)
    .send({ claimToken: item.claimToken })
    .expect(200);
  await getRequest().post(`/discovery-jobs/${job.id}/complete`).expect(200);
};

const proposal = (path: string, overrides: Record<string, unknown> = {}) => ({
  rootPath: path,
  kind: 'directory',
  summary: 'A project',
  recommendation: 'back_up',
  confidence: 'high',
  reason: 'Has local work',
  evidence: evidence({ contentKinds: ['source_code'] }),
  ...overrides,
});

const propose = (item: ClaimedItem, candidates: object[]) =>
  getRequest()
    .post(`/queue-items/${item.id}/review-candidates`)
    .send({ claimToken: item.claimToken, workerId: 'w1', candidates });

const listCandidates = async (
  sourceId: string,
  query: Record<string, string> = {},
) =>
  (
    await getRequest()
      .get(`/sources/${sourceId}/review-candidates`)
      .query(query)
      .expect(200)
  ).body as Record<string, any>[];

const decide = (
  id: string,
  body: object,
  headers: Record<string, string> = { 'X-Actor-Id': 'brandon' },
) =>
  getRequest()
    .patch(`/review-candidates/${id}/decision`)
    .set(headers)
    .send(body);

const candidateEvents = async (candidateId: string) =>
  (
    await getRequest()
      .get('/audit-events')
      .query({ reviewCandidateId: candidateId })
      .expect(200)
  ).body as {
    eventType: string;
    actorType: string;
    actorId: string | null;
    details: Record<string, any>;
  }[];

/** Proposes one candidate in a fresh, completed job and returns it. */
const proposeInNewJob = async (
  sourceId: string,
  path: string,
  overrides: Record<string, unknown> = {},
) => {
  const { job, item } = await startAndClaim(sourceId);
  const res = await propose(item, [proposal(path, overrides)]).expect(200);
  await finish(job, item);

  return { job, candidate: res.body[0] as Record<string, any> };
};

describe('creating and retrieving candidates', () => {
  it('creates a pending candidate and returns it by id and in the list', async () => {
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
    const detail = await getRequest()
      .get(`/review-candidates/${id}`)
      .expect(200);
    expect(detail.body).toMatchObject({
      id,
      exclusion: { state: 'none', ruleIds: [] },
      evidence: { contentKinds: ['source_code'] },
    });
    expect(await listCandidates(sourceId)).toHaveLength(1);
    await getRequest()
      .get('/review-candidates/123e4567-e89b-12d3-a456-426614174000')
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

    expect(await listCandidates(sourceId)).toHaveLength(3);
    expect(
      await listCandidates(sourceId, { recommendation: 'needs_review' }),
    ).toHaveLength(1);
    expect(await listCandidates(sourceId, { decision: 'approved' })).toEqual([
      expect.objectContaining({ id: a }),
    ]);
    expect(await listCandidates(sourceId, { jobId: job.id })).toHaveLength(3);
    expect(
      await listCandidates(sourceId, { pathPrefix: `${ROOT}\\sub` }),
    ).toHaveLength(1);
    // Keyset paging by normalizedRootPath.
    const page = await listCandidates(sourceId, { limit: '2' });
    const rest = await listCandidates(sourceId, {
      after: page[1].normalizedRootPath,
    });
    expect(rest).toHaveLength(1);
  });

  it('refuses candidates outside the claimed directory or from a dead claim', async () => {
    const sourceId = await createSource();
    const { item } = await startAndClaim(sourceId);

    const outside = await propose(item, [proposal('C:\\elsewhere\\x')]).expect(
      409,
    );
    expect(outside.body.paths).toEqual(['C:\\elsewhere\\x']);

    await getRequest()
      .post(`/queue-items/${item.id}/review-candidates`)
      .send({
        claimToken: '123e4567-e89b-12d3-a456-426614174000',
        candidates: [proposal(`${ROOT}\\a`)],
      })
      .expect(409);
    expect(await listCandidates(sourceId)).toHaveLength(0);
  });
});

describe('uniqueness and rediscovery', () => {
  it('keeps one candidate per source and normalized path', async () => {
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
    expect(await listCandidates(sourceId)).toHaveLength(1);
  });

  it('updates evidence and recommendation on rediscovery by another job', async () => {
    const sourceId = await createSource();
    const path = `${ROOT}\\project-a`;
    const first = await proposeInNewJob(sourceId, path, {
      recommendation: 'needs_review',
      confidence: 'low',
      reason: 'unknown local state',
    });

    const { job: job2, candidate } = await proposeInNewJob(sourceId, path, {
      recommendation: 'back_up',
      confidence: 'high',
      reason: 'uncommitted changes found',
      evidence: evidence({
        contentKinds: ['source_code'],
        observations: ['git status shows modified files'],
      }),
    });

    expect(candidate).toMatchObject({
      id: first.candidate.id,
      created: false,
      changed: true,
      recommendation: 'back_up',
      confidence: 'high',
      recommendationReason: 'uncommitted changes found',
      firstJobId: first.job.id,
      lastJobId: job2.id,
    });
    expect(candidate.evidence.observations).toEqual([
      'git status shows modified files',
    ]);
    expect(new Date(candidate.recommendedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(first.candidate.recommendedAt).getTime(),
    );
    expect(new Date(candidate.createdAt)).toEqual(
      new Date(first.candidate.createdAt),
    );
    expect(await listCandidates(sourceId)).toHaveLength(1);

    const events = await candidateEvents(first.candidate.id);
    expect(events.map((e) => e.eventType).sort()).toEqual([
      'review_candidate.created',
      'review_candidate.recommendation_changed',
    ]);
    const changed = events.find(
      (e) => e.eventType === 'review_candidate.recommendation_changed',
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
    const { candidate } = await proposeInNewJob(sourceId, path);
    const approved = await decide(candidate.id, {
      decision: 'approved',
      note: 'keep',
    }).expect(200);

    const again = await proposeInNewJob(sourceId, path, {
      recommendation: 'skip',
      confidence: 'high',
      reason: 'now looks reproducible',
      evidence: evidence({ reproducible: 'yes' }),
    });

    expect(again.candidate).toMatchObject({
      id: candidate.id,
      recommendation: 'skip',
      decision: 'approved',
      decisionNote: 'keep',
      decidedBy: 'brandon',
    });
    expect(again.candidate.decidedAt).toBe(approved.body.decidedAt);
    // The audit trail says a decision was already in place when it changed.
    const events = await candidateEvents(candidate.id);
    expect(
      events.find(
        (e) => e.eventType === 'review_candidate.recommendation_changed',
      )!.details.decision,
    ).toBe('approved');
  });

  it('writes no audit events for no-op re-proposals or repeated decisions', async () => {
    const sourceId = await createSource();
    const path = `${ROOT}\\project-a`;
    const { candidate } = await proposeInNewJob(sourceId, path);
    await proposeInNewJob(sourceId, path);
    await proposeInNewJob(sourceId, path);

    expect(await candidateEvents(candidate.id)).toHaveLength(1);

    await decide(candidate.id, { decision: 'approved' }).expect(200);
    await decide(candidate.id, { decision: 'approved' }).expect(200);
    expect(await candidateEvents(candidate.id)).toHaveLength(2);
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
    const { candidate } = await proposeInNewJob(sourceId, `${ROOT}\\a`);

    await decide(
      candidate.id,
      { decision: 'approved' },
      {
        'X-Actor-Type': 'openclaw',
        'X-Actor-Id': 'w1',
      },
    ).expect(409);
    await decide(
      candidate.id,
      { decision: 'rejected' },
      {
        'X-Actor-Type': 'system',
      },
    ).expect(409);

    const detail = await getRequest()
      .get(`/review-candidates/${candidate.id}`)
      .expect(200);
    expect(detail.body.decision).toBe('pending');
  });

  it('persists approval and rejection with audit events, and allows changing it', async () => {
    const sourceId = await createSource();
    const { candidate } = await proposeInNewJob(sourceId, `${ROOT}\\a`);

    const approved = await decide(candidate.id, {
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
    const rejected = await decide(candidate.id, {
      decision: 'rejected',
    }).expect(200);
    expect(rejected.body).toMatchObject({
      decision: 'rejected',
      decisionNote: null,
    });
    const reset = await decide(candidate.id, { decision: 'pending' }).expect(
      200,
    );
    expect(reset.body).toMatchObject({
      decision: 'pending',
      decidedAt: null,
      decidedBy: null,
    });

    const decisions = (await candidateEvents(candidate.id)).filter(
      (e) => e.eventType === 'review_candidate.decision_changed',
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

    await decide(candidate.id, { decision: 'maybe' }).expect(400);
    await getRequest()
      .patch('/review-candidates/123e4567-e89b-12d3-a456-426614174000/decision')
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
    expect(await listCandidates(sourceId)).toHaveLength(0);

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

  it('turns a repository into one candidate without its internal folders', async () => {
    const { sourceId } = await runFixtureJob();
    const candidates = await listCandidates(sourceId);

    const projectA = candidates.find(
      (c) => c.rootPath === 'C:\\code\\project-a',
    )!;
    expect(projectA).toMatchObject({
      recommendation: 'back_up',
      confidence: 'high',
      decision: 'pending',
      evidence: { git: { uncommittedChanges: true } },
    });
    expect(
      candidates.filter((c) =>
        c.normalizedRootPath.startsWith('c:\\code\\project-a\\'),
      ),
    ).toHaveLength(0);
    expect(candidates.map((c) => c.rootPath).sort()).toEqual(
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

  it('represents a standalone file and a personal-data folder as candidates', async () => {
    const { sourceId } = await runFixtureJob();
    const candidates = await listCandidates(sourceId);

    expect(
      candidates.find((c) => c.rootPath === 'C:\\Users\\You\\taxes-2025.xlsx'),
    ).toMatchObject({ kind: 'file', recommendation: 'back_up' });
    expect(
      candidates.find((c) => c.rootPath === 'C:\\Users\\You\\Documents'),
    ).toMatchObject({ kind: 'directory', recommendation: 'back_up' });
  });

  it('skips system paths with a recorded reason and no candidate', async () => {
    const { sourceId, job } = await runFixtureJob();
    const candidates = await listCandidates(sourceId);
    expect(
      candidates.some((c) => /windows|program files|appdata/i.test(c.rootPath)),
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
    const candidates = await listCandidates(sourceId);

    const mystery = candidates.find((c) => c.rootPath === 'C:\\data\\mystery')!;
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
    const candidates = await listCandidates(sourceId);

    const unknown = candidates.find(
      (c) => c.rootPath === 'C:\\code\\public-unknown',
    )!;
    expect(unknown.evidence.git).toMatchObject({
      remoteVisibility: 'public',
      localStateKnown: false,
    });
    expect(unknown.recommendation).toBe('needs_review');

    // Only a known-clean, fully pushed repository is skippable.
    const clean = candidates.find(
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
  it('rejects candidates under exclude_subtree and on a selective_only path itself', async () => {
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
    expect(await listCandidates(sourceId)).toHaveLength(0);

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

  it('keeps candidate history when a rule is added, and blocks approval', async () => {
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

    // Nothing was deleted: the candidate remains, now flagged by the rule.
    const detail = await getRequest()
      .get(`/review-candidates/${id}`)
      .expect(200);
    expect(detail.body.exclusion).toEqual({
      state: 'excluded',
      ruleIds: [rule.id],
    });
    expect(await listCandidates(sourceId)).toHaveLength(1);

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

describe('discovery writes only queue items and candidates', () => {
  const ME = 'C:\\Users\\Me';

  const queueOf = async (jobId: string) =>
    (await getRequest().get(`/discovery-jobs/${jobId}/queue-items`).expect(200))
      .body as Record<string, any>[];

  it('creates a job with exactly one queue item, the root', async () => {
    const sourceId = await createSource();
    const { job } = await startAndClaim(sourceId, ME);

    expect((await queueOf(job.id)).map((q) => q.path)).toEqual([ME]);
    expect(await listCandidates(sourceId)).toHaveLength(0);
  });

  it('proposes a photo folder as one candidate and queues nothing for it', async () => {
    const sourceId = await createSource();
    const { job, item } = await startAndClaim(sourceId, ME);

    await propose(item, [proposal(`${ME}\\Pictures\\Family`)]).expect(200);

    expect((await queueOf(job.id)).map((q) => q.path)).toEqual([ME]);
    expect(await listCandidates(sourceId)).toHaveLength(1);
  });

  it('proposes a repository as one candidate, with nothing for its internals', async () => {
    const sourceId = await createSource();
    const { job, item } = await startAndClaim(sourceId, 'C:\\code');

    await propose(item, [proposal('C:\\code\\my-project')]).expect(200);

    expect((await listCandidates(sourceId)).map((c) => c.rootPath)).toEqual([
      'C:\\code\\my-project',
    ]);
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

    expect(await queueOf(job.id)).toEqual(queueBefore);
    const events = (
      await getRequest().get('/audit-events').query({ sourceId }).expect(200)
    ).body.map((e: any) => e.eventType);
    expect(events.sort()).toEqual([
      'review_candidate.created',
      'review_candidate.decision_changed',
      'review_candidate.decision_changed',
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

    expect(await listCandidates(sourceId)).toHaveLength(0);
    expect((await queueOf(job.id))[0].result.skipped).toEqual([
      { path: `${ME}\\build\\out.tmp`, reason: 'generated' },
    ]);
  });

  it('no longer serves inventory routes', async () => {
    const sourceId = await createSource();
    const id = '123e4567-e89b-12d3-a456-426614174000';

    await getRequest().get(`/sources/${sourceId}/inventory-items`).expect(404);
    await getRequest().get(`/inventory-items/${id}`).expect(404);
    await getRequest()
      .post(`/queue-items/${id}/inventory-items`)
      .send({})
      .expect(404);
  });
});

describe('known skips across jobs', () => {
  const skipsOf = async (
    sourceId: string,
    query: Record<string, string> = {},
  ) =>
    (
      await getRequest()
        .get(`/sources/${sourceId}/known-skips`)
        .query(query)
        .expect(200)
    ).body as {
      path: string;
      reason: string;
      skippedAt: string;
      jobId: string;
    }[];

  /** Runs and finishes a job whose root directory records `skipped`. */
  const runSkipping = async (
    sourceId: string,
    skipped: { path: string; reason: string }[],
  ) => {
    const { job, item } = await startAndClaim(sourceId);
    await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send({ claimToken: item.claimToken, skipped })
      .expect(200);
    await getRequest().post(`/discovery-jobs/${job.id}/complete`).expect(200);

    return job;
  };

  it('shows a later job the paths an earlier job skipped, newest reason per path', async () => {
    const sourceId = await createSource();
    const first = await runSkipping(sourceId, [
      { path: `${ROOT}\\cache`, reason: 'generated' },
      { path: `${ROOT}\\Windows`, reason: 'operating system' },
    ]);
    expect((await skipsOf(sourceId)).map((s) => s.jobId)).toEqual([
      first.id,
      first.id,
    ]);

    // Same path spelled differently, with a newer reason; plus a new path.
    const second = await runSkipping(sourceId, [
      { path: 'c:/CODE/Cache/', reason: 'build output, regenerated daily' },
      { path: `${ROOT}\\tmp`, reason: 'scratch' },
    ]);

    const skips = await skipsOf(sourceId);
    expect(skips.map((s) => [s.path, s.reason, s.jobId])).toEqual([
      // The newest spelling of the path wins, like other display paths.
      ['C:\\CODE\\Cache', 'build output, regenerated daily', second.id],
      ['C:\\code\\tmp', 'scratch', second.id],
      ['C:\\code\\Windows', 'operating system', first.id],
    ]);
    expect(Date.parse(skips[0].skippedAt)).toBeGreaterThan(0);
  });

  it('filters by path prefix, limits, and stays within the source', async () => {
    const sourceId = await createSource();
    await runSkipping(sourceId, [
      { path: `${ROOT}\\a\\one`, reason: 'x' },
      { path: `${ROOT}\\a\\two`, reason: 'x' },
      { path: `${ROOT}\\ab`, reason: 'x' },
    ]);

    expect(
      (await skipsOf(sourceId, { pathPrefix: `${ROOT}\\a` })).map(
        (s) => s.path,
      ),
    ).toEqual(['C:\\code\\a\\one', 'C:\\code\\a\\two']);
    expect(await skipsOf(sourceId, { limit: '1' })).toHaveLength(1);
    expect(await skipsOf(await createSource())).toEqual([]);
    await getRequest()
      .get('/sources/123e4567-e89b-12d3-a456-426614174000/known-skips')
      .expect(404);
  });

  it('is a record of judgments, not a rule: it blocks neither queueing nor proposals', async () => {
    const sourceId = await createSource();
    await runSkipping(sourceId, [
      { path: `${ROOT}\\cache`, reason: 'generated' },
    ]);

    expect(
      (
        await getRequest()
          .get('/exclusion-rules')
          .query({ sourceId })
          .expect(200)
      ).body,
    ).toEqual([]);

    const { item } = await startAndClaim(sourceId);
    await propose(item, [proposal(`${ROOT}\\cache`)]).expect(200);
    const done = await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send({
        claimToken: item.claimToken,
        discoveredPaths: [`${ROOT}\\cache\\deep`],
      })
      .expect(200);
    expect(done.body.children[0].status).toBe('queued');
  });
});

describe('nested candidates', () => {
  it('reports the candidates a proposal sits inside or contains', async () => {
    const sourceId = await createSource();
    const { job, item } = await startAndClaim(sourceId);

    const first = await propose(item, [
      proposal(`${ROOT}\\repo`),
      proposal(`${ROOT}\\repo2`),
    ]).expect(200);
    expect(first.body[0].coveredBy).toEqual([]);
    expect(first.body[0].covers).toEqual([]);

    const res = await propose(item, [
      proposal(`${ROOT}\\REPO\\packages\\app`),
    ]).expect(200);
    const parent = first.body[0];
    expect(res.body[0].covers).toEqual([]);
    expect(res.body[0].coveredBy).toEqual([
      expect.objectContaining({
        id: parent.id,
        rootPath: parent.rootPath,
        decision: 'pending',
      }),
    ]);

    // Re-proposing the parent now reports the child, but not repo2.
    const again = await propose(item, [proposal(`${ROOT}\\repo`)]).expect(200);
    expect(again.body[0].covers).toEqual([
      expect.objectContaining({ id: res.body[0].id }),
    ]);
    expect(again.body[0].coveredBy).toEqual([]);

    await finish(job, item);
  });

  it('reports batch siblings to each other and includes the ancestor decision', async () => {
    const sourceId = await createSource();
    const { item } = await startAndClaim(sourceId);
    const parent = (
      await propose(item, [proposal(`${ROOT}\\mono`)]).expect(200)
    ).body[0];
    await decide(parent.id, { decision: 'approved' }).expect(200);

    const res = await propose(item, [
      proposal(`${ROOT}\\mono\\a`),
      proposal(`${ROOT}\\mono\\a\\b`),
    ]).expect(200);

    expect(res.body[0].coveredBy).toEqual([
      expect.objectContaining({ id: parent.id, decision: 'approved' }),
    ]);
    expect(res.body[0].covers).toEqual([
      expect.objectContaining({ id: res.body[1].id }),
    ]);
    expect(res.body[1].coveredBy.map((c: { id: string }) => c.id)).toEqual([
      parent.id,
      res.body[0].id,
    ]);
  });
});
