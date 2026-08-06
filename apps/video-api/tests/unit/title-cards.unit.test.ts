import supertest from 'supertest';
import * as videoDb from '@abbottland/video-db';
import { createServer } from '../../src/server';

// Partial mock: keep real value exports (e.g. titleCardSelectSchema, which
// openapi.ts needs to build the doc at module-load time) and only mock the
// query function under test here.
jest.mock('@abbottland/video-db', () => ({
  ...jest.requireActual('@abbottland/video-db'),
  listTitleCards: jest.fn(),
  deleteTitleCardById: jest.fn(),
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
      season: undefined,
    });
  });

  it('passes a valid season through to listTitleCards', async () => {
    (videoDb.listTitleCards as jest.Mock).mockResolvedValue([]);

    await supertest(createServer())
      .get('/title-cards')
      .query({ season: '4' })
      .expect(200);

    expect(videoDb.listTitleCards).toHaveBeenCalledWith(undefined, {
      fileHash: undefined,
      season: 4,
    });
  });

  it('rejects a non-numeric season', async () => {
    const res = await supertest(createServer())
      .get('/title-cards')
      .query({ season: 'bogus' })
      .expect(400);

    expect(res.body.message).toBe('Invalid query parameters');
    expect(videoDb.listTitleCards).not.toHaveBeenCalled();
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

describe('DELETE /title-cards/:id', () => {
  let consoleErrorSpy: jest.SpyInstance;
  const VALID_ID = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  it('rejects a non-UUID id without touching the database', async () => {
    const res = await supertest(createServer())
      .delete('/title-cards/not-a-uuid')
      .expect(400);

    expect(res.body.message).toBe('Invalid request parameters');
    expect(videoDb.deleteTitleCardById).not.toHaveBeenCalled();
  });

  it('returns 404 when no title card matches the id', async () => {
    (videoDb.deleteTitleCardById as jest.Mock).mockResolvedValue(undefined);

    const res = await supertest(createServer())
      .delete(`/title-cards/${VALID_ID}`)
      .expect(404);

    expect(res.body).toEqual({ message: 'title card not found' });
  });

  it('deletes the title card and returns it', async () => {
    const deleted = { id: VALID_ID, title: 'Pups Save a Blimp' };
    (videoDb.deleteTitleCardById as jest.Mock).mockResolvedValue(deleted);

    const res = await supertest(createServer())
      .delete(`/title-cards/${VALID_ID}`)
      .expect(200);

    expect(videoDb.deleteTitleCardById).toHaveBeenCalledWith(
      undefined,
      VALID_ID,
    );
    expect(res.body).toEqual(deleted);
  });

  it('logs the error and returns a generic message when deletion fails', async () => {
    const dbError = new Error('connection refused');
    (videoDb.deleteTitleCardById as jest.Mock).mockRejectedValue(dbError);

    const res = await supertest(createServer())
      .delete(`/title-cards/${VALID_ID}`)
      .expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `DELETE /title-cards/${VALID_ID} failed:`,
      dbError,
    );
  });
});
