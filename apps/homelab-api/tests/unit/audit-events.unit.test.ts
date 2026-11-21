import supertest from 'supertest';
import { createServer } from '../../src/server';
import * as service from '../../src/services/discovery';

jest.mock('../../src/services/discovery', () => {
  const actual = jest.requireActual('../../src/services/discovery');

  return {
    DiscoveryError: actual.DiscoveryError,
    listAuditEvents: jest.fn(),
  };
});

const mocked = jest.mocked(service);
const ID = '123e4567-e89b-12d3-a456-426614174000';
const SOURCE_ID = '323e4567-e89b-12d3-a456-426614174000';

describe('audit routes', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  describe('GET /audit-events', () => {
    it('passes filters and defaults the limit', async () => {
      mocked.listAuditEvents.mockResolvedValue([]);

      await supertest(createServer())
        .get(
          `/audit-events?sourceId=${SOURCE_ID}&eventType=inventory_item.created&since=2026-10-01T00:00:00Z`,
        )
        .expect(200);

      expect(mocked.listAuditEvents).toHaveBeenCalledWith({
        sourceId: SOURCE_ID,
        eventType: 'inventory_item.created',
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
