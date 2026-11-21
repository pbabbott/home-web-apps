import supertest from 'supertest';
import * as budgetDb from '@abbottland/budget-db';
import { createServer } from '../../src/server';

// Partial mock: keep real value exports (e.g. budgetJobSelectSchema, which
// openapi.ts needs to build the doc at module-load time) and only mock
// pingDb/hasAppliedLatestMigration, which are under test here.
jest.mock('@abbottland/budget-db', () => ({
  ...jest.requireActual('@abbottland/budget-db'),
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
    (budgetDb.pingDb as jest.Mock).mockResolvedValue(undefined);
    (budgetDb.hasAppliedLatestMigration as jest.Mock).mockResolvedValue(true);

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
    (budgetDb.pingDb as jest.Mock).mockRejectedValue(dbError);

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
    expect(budgetDb.hasAppliedLatestMigration).not.toHaveBeenCalled();
  });

  it('returns 503 when the database schema is behind', async () => {
    (budgetDb.pingDb as jest.Mock).mockResolvedValue(undefined);
    (budgetDb.hasAppliedLatestMigration as jest.Mock).mockResolvedValue(false);

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
    (budgetDb.pingDb as jest.Mock).mockResolvedValue(undefined);
    const checkError = new Error('relation does not exist');
    (budgetDb.hasAppliedLatestMigration as jest.Mock).mockRejectedValue(
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
