import supertest from 'supertest';
import { createServer } from '../../src/server';
import * as service from '../../src/services/discovery';

jest.mock('../../src/services/discovery', () => {
  const actual = jest.requireActual('../../src/services/discovery');

  return {
    DiscoveryError: actual.DiscoveryError,
    listExclusionRules: jest.fn(),
    createExclusionRule: jest.fn(),
    updateExclusionRule: jest.fn(),
    deleteExclusionRule: jest.fn(),
    listAuditEvents: jest.fn(),
  };
});

const mocked = jest.mocked(service);
const ID = '123e4567-e89b-12d3-a456-426614174000';
const SOURCE_ID = '323e4567-e89b-12d3-a456-426614174000';

describe('exclusion rule, review and audit routes', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  describe('POST /exclusion-rules', () => {
    it('creates a global rule by default and attributes it to a human', async () => {
      mocked.createExclusionRule.mockResolvedValue({ id: ID } as never);

      await supertest(createServer())
        .post('/exclusion-rules')
        .send({ path: 'C:\\Windows', scope: 'exclude_subtree' })
        .expect(201);

      expect(mocked.createExclusionRule).toHaveBeenCalledWith(
        { sourceId: null, path: 'C:\\Windows', scope: 'exclude_subtree' },
        { type: 'human', id: null },
      );
    });

    it('passes actor headers through', async () => {
      mocked.createExclusionRule.mockResolvedValue({ id: ID } as never);

      await supertest(createServer())
        .post('/exclusion-rules')
        .set('X-Actor-Type', 'openclaw')
        .set('X-Actor-Id', 'cron-1')
        .send({
          sourceId: SOURCE_ID,
          path: 'C:\\build',
          scope: 'selective_only',
          reason: 'generated',
        })
        .expect(201);

      expect(mocked.createExclusionRule).toHaveBeenCalledWith(
        expect.objectContaining({ sourceId: SOURCE_ID, reason: 'generated' }),
        { type: 'openclaw', id: 'cron-1' },
      );
    });

    it('rejects an unknown actor type', async () => {
      const res = await supertest(createServer())
        .post('/exclusion-rules')
        .set('X-Actor-Type', 'robot')
        .send({ path: 'C:\\Windows', scope: 'exclude_subtree' })
        .expect(400);

      expect(res.body.message).toBe('Invalid actor headers');
      expect(mocked.createExclusionRule).not.toHaveBeenCalled();
    });

    it.each([
      ['an unknown scope', { path: 'C:\\x', scope: 'delete' }],
      ['a relative path', { path: 'foo\\bar', scope: 'exclude_subtree' }],
      ['a missing scope', { path: 'C:\\x' }],
    ])('rejects %s', async (_name, body) => {
      await supertest(createServer())
        .post('/exclusion-rules')
        .send(body)
        .expect(400);

      expect(mocked.createExclusionRule).not.toHaveBeenCalled();
    });

    it('maps a conflict to 409', async () => {
      mocked.createExclusionRule.mockRejectedValue(
        new service.DiscoveryError('conflict', 'a rule already exists'),
      );

      await supertest(createServer())
        .post('/exclusion-rules')
        .send({ path: 'C:\\Windows', scope: 'exclude_subtree' })
        .expect(409);
    });
  });

  describe('PATCH /exclusion-rules/:id', () => {
    it('requires scope or reason', async () => {
      await supertest(createServer())
        .patch(`/exclusion-rules/${ID}`)
        .send({})
        .expect(400);
    });

    it('maps a missing rule to 404', async () => {
      mocked.updateExclusionRule.mockRejectedValue(
        new service.DiscoveryError('not_found', 'exclusion rule not found'),
      );

      await supertest(createServer())
        .patch(`/exclusion-rules/${ID}`)
        .send({ reason: 'x' })
        .expect(404);
    });
  });

  describe('DELETE /exclusion-rules/:id', () => {
    it('answers 204', async () => {
      mocked.deleteExclusionRule.mockResolvedValue(undefined);

      await supertest(createServer())
        .delete(`/exclusion-rules/${ID}`)
        .expect(204);

      expect(mocked.deleteExclusionRule).toHaveBeenCalledWith(ID, {
        type: 'human',
        id: null,
      });
    });
  });

  describe('GET /audit-events', () => {
    it('passes filters and defaults the limit', async () => {
      mocked.listAuditEvents.mockResolvedValue([]);

      await supertest(createServer())
        .get(
          `/audit-events?sourceId=${SOURCE_ID}&eventType=exclusion_rule.deleted&since=2026-10-01T00:00:00Z`,
        )
        .expect(200);

      expect(mocked.listAuditEvents).toHaveBeenCalledWith({
        sourceId: SOURCE_ID,
        eventType: 'exclusion_rule.deleted',
        since: '2026-10-01T00:00:00Z',
        limit: 100,
      });
    });

    it('rejects an unknown event type and an oversized limit', async () => {
      await supertest(createServer())
        .get('/audit-events?eventType=bogus')
        .expect(400);
      await supertest(createServer())
        .get('/audit-events?limit=501')
        .expect(400);
    });

    it('offers no write routes', async () => {
      await supertest(createServer()).post('/audit-events').expect(404);
      await supertest(createServer()).delete('/audit-events').expect(404);
      await supertest(createServer()).patch(`/audit-events/${ID}`).expect(404);
    });
  });
});
