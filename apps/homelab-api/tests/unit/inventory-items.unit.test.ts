import supertest from 'supertest';
import { createServer } from '../../src/server';
import * as service from '../../src/services/discovery';

jest.mock('../../src/services/discovery', () => {
  const actual = jest.requireActual('../../src/services/discovery');

  return {
    DiscoveryError: actual.DiscoveryError,
    proposeInventoryItems: jest.fn(),
    listSourceInventoryItems: jest.fn(),
    getInventoryItem: jest.fn(),
    decideInventoryItem: jest.fn(),
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

const inventoryItem = (overrides: Record<string, unknown> = {}) => ({
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
  inventoryItem({
    evidence: { ...inventoryItem().evidence, git, reproducible: 'yes' },
    ...overrides,
  });

const propose = (inventoryItems: unknown[]) =>
  supertest(createServer())
    .post(`/queue-items/${ID}/inventory-items`)
    .send({ claimToken: TOKEN, inventoryItems });

describe('inventory item routes', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  describe('POST /queue-items/:id/inventory-items', () => {
    it('flattens results with created and changed flags', async () => {
      mocked.proposeInventoryItems.mockResolvedValue([
        { inventoryItem: { id: ID }, created: true, changed: false },
      ] as never);

      const res = await propose([inventoryItem()]).expect(200);

      expect(res.body).toEqual([{ id: ID, created: true, changed: false }]);
      expect(mocked.proposeInventoryItems).toHaveBeenCalledWith(
        ID,
        TOKEN,
        expect.any(Array),
      );
    });

    it('passes coveredBy and covers through', async () => {
      const nested = [{ id: ID, rootPath: 'C:\\code' }];
      mocked.proposeInventoryItems.mockResolvedValue([
        {
          inventoryItem: { id: ID },
          created: true,
          changed: false,
          coveredBy: nested,
          covers: [],
        },
      ] as never);

      const res = await propose([inventoryItem()]).expect(200);

      expect(res.body[0].coveredBy).toEqual(nested);
      expect(res.body[0].covers).toEqual([]);
    });

    it('rejects low confidence for back_up and skip but allows needs_review', async () => {
      await propose([inventoryItem({ confidence: 'low' })]).expect(400);
      await propose([
        inventoryItem({ recommendation: 'skip', confidence: 'low' }),
      ]).expect(400);
      expect(mocked.proposeInventoryItems).not.toHaveBeenCalled();

      mocked.proposeInventoryItems.mockResolvedValue([] as never);
      await propose([
        inventoryItem({ recommendation: 'needs_review', confidence: 'low' }),
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
      expect(mocked.proposeInventoryItems).not.toHaveBeenCalled();
    });

    it('allows skipping a repo only when its clean state is known', async () => {
      mocked.proposeInventoryItems.mockResolvedValue([] as never);

      await propose([
        withGit(cleanGit, { recommendation: 'skip', confidence: 'high' }),
      ]).expect(200);
    });

    it('allows needs_review for a public repo with unknown local state', async () => {
      mocked.proposeInventoryItems.mockResolvedValue([] as never);

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
      await propose([inventoryItem({ rootPath: 'relative\\path' })]).expect(
        400,
      );
      await propose([]).expect(400);
      await propose(Array.from({ length: 11 }, () => inventoryItem())).expect(
        400,
      );
    });

    it('ignores a decision field: the agent cannot approve or reject', async () => {
      mocked.proposeInventoryItems.mockResolvedValue([] as never);

      await propose([inventoryItem({ decision: 'approved' })]).expect(200);

      const sent = mocked.proposeInventoryItems.mock.calls[0][2][0];
      expect(sent).not.toHaveProperty('decision');
    });

    it('maps exclusion and claim conflicts to 409 with details', async () => {
      mocked.proposeInventoryItems.mockRejectedValue(
        new service.DiscoveryError('conflict', 'excluded', {
          blocked: [{ path: 'C:\\Windows', state: 'excluded', ruleIds: ['r'] }],
        }),
      );

      const res = await propose([inventoryItem()]).expect(409);

      expect(res.body.blocked).toHaveLength(1);
    });
  });

  describe('GET /sources/:id/inventory-items', () => {
    it('passes filters and defaults the limit', async () => {
      mocked.listSourceInventoryItems.mockResolvedValue([]);

      await supertest(createServer())
        .get(
          `/sources/${SOURCE_ID}/inventory-items?recommendation=back_up&decision=pending&jobId=${ID}`,
        )
        .expect(200);

      expect(mocked.listSourceInventoryItems).toHaveBeenCalledWith(SOURCE_ID, {
        recommendation: 'back_up',
        decision: 'pending',
        jobId: ID,
        limit: 100,
      });
    });

    it('rejects unknown filter values', async () => {
      await supertest(createServer())
        .get(`/sources/${SOURCE_ID}/inventory-items?decision=maybe`)
        .expect(400);
      await supertest(createServer())
        .get(`/sources/${SOURCE_ID}/inventory-items?recommendation=keep`)
        .expect(400);
    });
  });

  describe('GET /inventory-items/:id', () => {
    it('returns 404 for a missing inventory item', async () => {
      mocked.getInventoryItem.mockRejectedValue(
        new service.DiscoveryError('not_found', 'inventory item not found'),
      );

      await supertest(createServer()).get(`/inventory-items/${ID}`).expect(404);
    });
  });

  describe('PATCH /inventory-items/:id/decision', () => {
    it('applies the decision with the actor', async () => {
      mocked.decideInventoryItem.mockResolvedValue({ id: ID } as never);

      await supertest(createServer())
        .patch(`/inventory-items/${ID}/decision`)
        .set('X-Actor-Id', 'brandon')
        .send({ decision: 'approved', note: 'tax records' })
        .expect(200);

      expect(mocked.decideInventoryItem).toHaveBeenCalledWith(
        ID,
        { decision: 'approved', note: 'tax records' },
        { type: 'human', id: 'brandon' },
      );
    });

    it('passes a non-human actor through so the service can refuse it', async () => {
      mocked.decideInventoryItem.mockRejectedValue(
        new service.DiscoveryError('conflict', 'only a human can decide'),
      );

      await supertest(createServer())
        .patch(`/inventory-items/${ID}/decision`)
        .set('X-Actor-Type', 'openclaw')
        .send({ decision: 'approved' })
        .expect(409);
    });

    it('rejects an unknown decision', async () => {
      await supertest(createServer())
        .patch(`/inventory-items/${ID}/decision`)
        .send({ decision: 'maybe' })
        .expect(400);

      expect(mocked.decideInventoryItem).not.toHaveBeenCalled();
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
          skippedGroups: [],
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
