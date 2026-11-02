import supertest from 'supertest';
import * as homelabDb from '@abbottland/homelab-db';
import { createServer } from '../../src/server';
import { DestinationWatchdog } from '../../src/destination/watchdog';

jest.mock('@abbottland/homelab-db', () => ({
  ...jest.requireActual('@abbottland/homelab-db'),
  pingDb: jest.fn(),
  hasAppliedLatestMigration: jest.fn(),
}));

jest.mock('../../src/db', () => ({ db: {} }));

jest.mock('../../src/config', () => ({
  config: {
    backupStallTimeoutSeconds: 1,
    port: 0,
  },
}));

const mocked = homelabDb as unknown as Record<string, jest.Mock>;

const newWatchdog = () => new DestinationWatchdog(1000);

describe('probes', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation();
    mocked.pingDb.mockResolvedValue(undefined);
    mocked.hasAppliedLatestMigration.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  it('/readyz is 200 when the database is reachable and current', async () => {
    await supertest(createServer(newWatchdog())).get('/readyz').expect(200);
  });

  it('/readyz is 503 when the database is unreachable', async () => {
    mocked.pingDb.mockRejectedValue(new Error('connection refused'));
    await supertest(createServer(newWatchdog())).get('/readyz').expect(503);
  });

  it('/readyz is 503 when the schema is behind', async () => {
    mocked.hasAppliedLatestMigration.mockResolvedValue(false);
    await supertest(createServer(newWatchdog())).get('/readyz').expect(503);
  });

  it('/healthz is 200 normally', async () => {
    await supertest(createServer(newWatchdog())).get('/healthz').expect(200);
  });

  it('a stalled destination call fails /readyz and keeps /healthz up within the grace', async () => {
    jest.useFakeTimers();
    const watchdog = newWatchdog();
    const server = createServer(watchdog);

    watchdog.run('write', () => new Promise(() => undefined));

    await jest.advanceTimersByTimeAsync(1000);
    jest.useRealTimers();

    await supertest(server).get('/readyz').expect(503);
    await supertest(server).get('/healthz').expect(200);
  });
});
