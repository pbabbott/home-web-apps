import supertest from 'supertest';
import { createServer } from '../../src/server';
import * as service from '../../src/services/discovery';

jest.mock('../../src/services/discovery', () => {
  const actual = jest.requireActual('../../src/services/discovery');

  return {
    DiscoveryError: actual.DiscoveryError,
    proposeCandidates: jest.fn(),
    listSourceReviewCandidates: jest.fn(),
    getReviewCandidate: jest.fn(),
    decideReviewCandidate: jest.fn(),
    completeItem: jest.fn(),
  };
});

const mocked = jest.mocked(service);
const ID = '123e4567-e89b-12d3-a456-426614174000';
const SOURCE_ID = '323e4567-e89b-12d3-a456-426614174000';
const TOKEN = '8c1b0c3e-5a53-4a7c-8f4e-2b1f3d9a6e11';

const cleanGit = {
  remoteUrl: 'https://github.com/x/y',
  remoteVisibility: 'public',
  localStateKnown: true,
  uncommittedChanges: false,
  untrackedFiles: false,
  unpushedCommits: false,
  ignoredFilesOfNote: false,
};

const candidate = (overrides: Record<string, unknown> = {}) => ({
  rootPath: 'C:\\code\\project-a',
  kind: 'directory',
  summary: 'A project',
  recommendation: 'back_up',
  confidence: 'high',
  reason: 'Has local work',
  evidence: {
    contentKinds: ['source_code'],
    git: null,
    reproducible: 'no',
    sufficientInformation: true,
    observations: ['.git present'],
    openQuestions: [],
  },
  ...overrides,
});

const withGit = (git: unknown, overrides: Record<string, unknown> = {}) =>
  candidate({
    evidence: { ...candidate().evidence, git, reproducible: 'yes' },
    ...overrides,
  });

const propose = (candidates: unknown[]) =>
  supertest(createServer())
    .post(`/queue-items/${ID}/review-candidates`)
    .send({ claimToken: TOKEN, workerId: 'w1', candidates });

describe('review candidate routes', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  describe('POST /queue-items/:id/review-candidates', () => {
    it('flattens results with created and changed flags', async () => {
      mocked.proposeCandidates.mockResolvedValue([
        { candidate: { id: ID }, created: true, changed: false },
      ] as never);

      const res = await propose([candidate()]).expect(200);

      expect(res.body).toEqual([{ id: ID, created: true, changed: false }]);
      expect(mocked.proposeCandidates).toHaveBeenCalledWith(
        ID,
        TOKEN,
        'w1',
        expect.any(Array),
      );
    });

    it('rejects low confidence for back_up and skip but allows needs_review', async () => {
      await propose([candidate({ confidence: 'low' })]).expect(400);
      await propose([
        candidate({ recommendation: 'skip', confidence: 'low' }),
      ]).expect(400);
      expect(mocked.proposeCandidates).not.toHaveBeenCalled();

      mocked.proposeCandidates.mockResolvedValue([] as never);
      await propose([
        candidate({ recommendation: 'needs_review', confidence: 'low' }),
      ]).expect(200);
    });

    it('does not let a public remote alone make a repo skippable', async () => {
      await propose([
        withGit(
          { ...cleanGit, localStateKnown: false, uncommittedChanges: null },
          { recommendation: 'skip', confidence: 'medium' },
        ),
      ]).expect(400);
      await propose([
        withGit(
          { ...cleanGit, unpushedCommits: true },
          { recommendation: 'skip', confidence: 'high' },
        ),
      ]).expect(400);
      await propose([
        withGit(
          { ...cleanGit, untrackedFiles: true },
          { recommendation: 'skip', confidence: 'high' },
        ),
      ]).expect(400);
      expect(mocked.proposeCandidates).not.toHaveBeenCalled();
    });

    it('allows skipping a repo only when its clean state is known', async () => {
      mocked.proposeCandidates.mockResolvedValue([] as never);

      await propose([
        withGit(cleanGit, { recommendation: 'skip', confidence: 'high' }),
      ]).expect(200);
    });

    it('allows needs_review for a public repo with unknown local state', async () => {
      mocked.proposeCandidates.mockResolvedValue([] as never);

      await propose([
        withGit(
          {
            ...cleanGit,
            localStateKnown: false,
            uncommittedChanges: null,
            untrackedFiles: null,
            unpushedCommits: null,
            ignoredFilesOfNote: null,
          },
          { recommendation: 'needs_review', confidence: 'low' },
        ),
      ]).expect(200);
    });

    it('rejects bad paths, empty batches and oversized batches', async () => {
      await propose([candidate({ rootPath: 'relative\\path' })]).expect(400);
      await propose([]).expect(400);
      await propose(Array.from({ length: 11 }, () => candidate())).expect(400);
    });

    it('ignores a decision field: the agent cannot approve or reject', async () => {
      mocked.proposeCandidates.mockResolvedValue([] as never);

      await propose([candidate({ decision: 'approved' })]).expect(200);

      const sent = mocked.proposeCandidates.mock.calls[0][3][0];
      expect(sent).not.toHaveProperty('decision');
    });

    it('maps exclusion and claim conflicts to 409 with details', async () => {
      mocked.proposeCandidates.mockRejectedValue(
        new service.DiscoveryError('conflict', 'excluded', {
          blocked: [{ path: 'C:\\Windows', state: 'excluded', ruleIds: ['r'] }],
        }),
      );

      const res = await propose([candidate()]).expect(409);

      expect(res.body.blocked).toHaveLength(1);
    });
  });

  describe('GET /sources/:id/review-candidates', () => {
    it('passes filters and defaults the limit', async () => {
      mocked.listSourceReviewCandidates.mockResolvedValue([]);

      await supertest(createServer())
        .get(
          `/sources/${SOURCE_ID}/review-candidates?recommendation=back_up&decision=pending&jobId=${ID}`,
        )
        .expect(200);

      expect(mocked.listSourceReviewCandidates).toHaveBeenCalledWith(
        SOURCE_ID,
        {
          recommendation: 'back_up',
          decision: 'pending',
          jobId: ID,
          limit: 100,
        },
      );
    });

    it('rejects unknown filter values', async () => {
      await supertest(createServer())
        .get(`/sources/${SOURCE_ID}/review-candidates?decision=maybe`)
        .expect(400);
      await supertest(createServer())
        .get(`/sources/${SOURCE_ID}/review-candidates?recommendation=keep`)
        .expect(400);
    });
  });

  describe('GET /review-candidates/:id', () => {
    it('returns 404 for a missing candidate', async () => {
      mocked.getReviewCandidate.mockRejectedValue(
        new service.DiscoveryError('not_found', 'review candidate not found'),
      );

      await supertest(createServer())
        .get(`/review-candidates/${ID}`)
        .expect(404);
    });
  });

  describe('PATCH /review-candidates/:id/decision', () => {
    it('applies the decision with the actor', async () => {
      mocked.decideReviewCandidate.mockResolvedValue({ id: ID } as never);

      await supertest(createServer())
        .patch(`/review-candidates/${ID}/decision`)
        .set('X-Actor-Id', 'brandon')
        .send({ decision: 'approved', note: 'tax records' })
        .expect(200);

      expect(mocked.decideReviewCandidate).toHaveBeenCalledWith(
        ID,
        { decision: 'approved', note: 'tax records' },
        { type: 'human', id: 'brandon' },
      );
    });

    it('passes a non-human actor through so the service can refuse it', async () => {
      mocked.decideReviewCandidate.mockRejectedValue(
        new service.DiscoveryError('conflict', 'only a human can decide'),
      );

      await supertest(createServer())
        .patch(`/review-candidates/${ID}/decision`)
        .set('X-Actor-Type', 'openclaw')
        .send({ decision: 'approved' })
        .expect(409);
    });

    it('rejects an unknown decision', async () => {
      await supertest(createServer())
        .patch(`/review-candidates/${ID}/decision`)
        .send({ decision: 'maybe' })
        .expect(400);

      expect(mocked.decideReviewCandidate).not.toHaveBeenCalled();
    });
  });

  describe('POST /queue-items/:id/complete', () => {
    it('accepts plain paths and structured follow-ups with a result', async () => {
      mocked.completeItem.mockResolvedValue({
        item: { id: ID },
        children: [],
      } as never);

      await supertest(createServer())
        .post(`/queue-items/${ID}/complete`)
        .send({
          claimToken: TOKEN,
          discoveredPaths: [
            'C:\\a',
            { path: 'C:\\b', reason: 'likely repos', priority: 5 },
          ],
          summary: 'assessed root',
          skipped: [{ path: 'C:\\Windows', reason: 'operating system' }],
        })
        .expect(200);

      expect(mocked.completeItem).toHaveBeenCalledWith(
        ID,
        TOKEN,
        ['C:\\a', { path: 'C:\\b', reason: 'likely repos', priority: 5 }],
        {
          summary: 'assessed root',
          skipped: [{ path: 'C:\\Windows', reason: 'operating system' }],
        },
      );
    });

    it('stays backward compatible with the old body', async () => {
      mocked.completeItem.mockResolvedValue({
        item: { id: ID },
        children: [],
      } as never);

      await supertest(createServer())
        .post(`/queue-items/${ID}/complete`)
        .send({ claimToken: TOKEN, discoveredPaths: ['C:\\a'] })
        .expect(200);
    });
  });
});
