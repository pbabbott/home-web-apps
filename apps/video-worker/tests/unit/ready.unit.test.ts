import supertest from 'supertest';
import * as videoDb from '@abbottland/video-db';
import { createServer } from '../../src/server';

jest.mock('@abbottland/video-db', () => ({
  ...jest.requireActual('@abbottland/video-db'),
  pingDb: jest.fn(),
  hasAppliedLatestMigration: jest.fn(),
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

  it('returns 200 when the database is reachable and schema is current', async () => {
    (videoDb.pingDb as jest.Mock).mockResolvedValue(undefined);
    (videoDb.hasAppliedLatestMigration as jest.Mock).mockResolvedValue(true);

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
    expect(videoDb.hasAppliedLatestMigration).not.toHaveBeenCalled();
  });

  it('returns 503 when the database schema is behind', async () => {
    (videoDb.pingDb as jest.Mock).mockResolvedValue(undefined);
    (videoDb.hasAppliedLatestMigration as jest.Mock).mockResolvedValue(false);

    await supertest(createServer())
      .get('/readyz')
      .expect(503)
      .then((res) => {
        expect(res.body.message).toBe('database schema is out of date');
      });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('database schema is out of date'),
    );
  });

  it('returns 503 and logs the error when the schema check itself fails', async () => {
    (videoDb.pingDb as jest.Mock).mockResolvedValue(undefined);
    const checkError = new Error('relation does not exist');
    (videoDb.hasAppliedLatestMigration as jest.Mock).mockRejectedValue(
      checkError,
    );

    await supertest(createServer())
      .get('/readyz')
      .expect(503)
      .then((res) => {
        expect(res.body.message).toBe('could not verify database schema');
      });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('could not verify database schema'),
      checkError,
    );
  });
});
