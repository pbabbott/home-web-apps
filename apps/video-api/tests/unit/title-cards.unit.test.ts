import supertest from 'supertest';
import * as videoDb from '@abbottland/video-db';
import { createServer } from '../../src/server';

// Partial mock: keep real value exports (e.g. titleCardSelectSchema, which
// openapi.ts needs to build the doc at module-load time) and only mock the
// query function under test here.
jest.mock('@abbottland/video-db', () => ({
  ...jest.requireActual('@abbottland/video-db'),
  listTitleCards: jest.fn(),
}));

describe('GET /title-cards', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  it('returns matching title cards', async () => {
    (videoDb.listTitleCards as jest.Mock).mockResolvedValue([
      { id: 'tc-1', title: 'Pups Save a Blimp' },
    ]);

    const res = await supertest(createServer()).get('/title-cards').expect(200);

    expect(res.body).toEqual({
      titleCards: [{ id: 'tc-1', title: 'Pups Save a Blimp' }],
    });
  });

  it('passes a valid fileHash through to listTitleCards', async () => {
    (videoDb.listTitleCards as jest.Mock).mockResolvedValue([]);

    await supertest(createServer())
      .get('/title-cards')
      .query({ fileHash: 'hash-1' })
      .expect(200);

    expect(videoDb.listTitleCards).toHaveBeenCalledWith(undefined, {
      fileHash: 'hash-1',
    });
  });

  it('logs the error and returns a generic message when listing fails', async () => {
    const dbError = new Error('connection refused');
    (videoDb.listTitleCards as jest.Mock).mockRejectedValue(dbError);

    const res = await supertest(createServer()).get('/title-cards').expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'GET /title-cards failed:',
      dbError,
    );
  });
});
