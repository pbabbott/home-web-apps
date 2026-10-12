import supertest from 'supertest';
import * as videoDb from '@abbottland/video-db';
import { createServer } from '../../src/server';

// Partial mock: keep real value exports (e.g. seriesSelectSchema, which
// openapi.ts needs to build the doc at module-load time) and only mock the
// query function under test here.
jest.mock('@abbottland/video-db', () => ({
  ...jest.requireActual('@abbottland/video-db'),
  listSeries: jest.fn(),
}));

describe('GET /series', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  it('returns every series', async () => {
    (videoDb.listSeries as jest.Mock).mockResolvedValue([
      { id: 's-1', seriesName: 'Paw Patrol', directoryName: 'Paw Patrol' },
    ]);

    const res = await supertest(createServer()).get('/series').expect(200);

    expect(res.body).toEqual({
      series: [
        { id: 's-1', seriesName: 'Paw Patrol', directoryName: 'Paw Patrol' },
      ],
    });
  });

  it('logs the error and returns a generic message when listing fails', async () => {
    const dbError = new Error('connection refused');
    (videoDb.listSeries as jest.Mock).mockRejectedValue(dbError);

    const res = await supertest(createServer()).get('/series').expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'GET /series failed:',
      dbError,
    );
  });
});
