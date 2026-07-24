import supertest from 'supertest';
import * as videoDb from '@abbottland/video-db';
import { createServer } from '../../src/server';

jest.mock('@abbottland/video-db');

describe('GET /readyz', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns 200 when the database is reachable', async () => {
    (videoDb.pingDb as jest.Mock).mockResolvedValue(undefined);

    await supertest(createServer())
      .get('/readyz')
      .expect(200)
      .then((res) => {
        expect(res.body.status).toBe('ok');
      });
  });

  it('returns 503 when the database is unreachable', async () => {
    (videoDb.pingDb as jest.Mock).mockRejectedValue(
      new Error('connection refused'),
    );

    await supertest(createServer())
      .get('/readyz')
      .expect(503)
      .then((res) => {
        expect(res.body.status).toBe('error');
      });
  });
});
