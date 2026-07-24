import supertest from 'supertest';
import * as videoDb from '@abbottland/video-db';
import { createServer } from '../../src/server';

jest.mock('@abbottland/video-db', () => ({
  ...jest.requireActual('@abbottland/video-db'),
  pingDb: jest.fn(),
}));

describe('GET /readyz', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
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

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('returns 503 and logs the underlying error when the database is unreachable', async () => {
    const dbError = new Error('connection refused');
    (videoDb.pingDb as jest.Mock).mockRejectedValue(dbError);

    await supertest(createServer())
      .get('/readyz')
      .expect(503)
      .then((res) => {
        expect(res.body.status).toBe('error');
      });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('GET /readyz failed'),
      dbError,
    );
  });
});
