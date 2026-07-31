import supertest from 'supertest';
import * as videoDb from '@abbottland/video-db';
import { createServer } from '../../src/server';

// Partial mock: keep real value exports (e.g. fileRenameSelectSchema, which
// openapi.ts needs to build the doc at module-load time) and only mock the
// query function under test here.
jest.mock('@abbottland/video-db', () => ({
  ...jest.requireActual('@abbottland/video-db'),
  listFileRenames: jest.fn(),
  deleteFileRenamesBySeason: jest.fn(),
  deleteFileRenameById: jest.fn(),
}));

describe('GET /file-renames', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  it('returns matching rename suggestions', async () => {
    (videoDb.listFileRenames as jest.Mock).mockResolvedValue([
      { id: 'fr-1', status: 'pending' },
    ]);

    const res = await supertest(createServer())
      .get('/file-renames')
      .expect(200);

    expect(res.body).toEqual({
      fileRenames: [{ id: 'fr-1', status: 'pending' }],
    });
  });

  it('rejects an unsupported status without touching the database', async () => {
    const res = await supertest(createServer())
      .get('/file-renames')
      .query({ status: 'bogus' })
      .expect(400);

    expect(res.body.message).toBe('Invalid query parameters');
    expect(videoDb.listFileRenames).not.toHaveBeenCalled();
  });

  it('passes a valid status through to listFileRenames', async () => {
    (videoDb.listFileRenames as jest.Mock).mockResolvedValue([]);

    await supertest(createServer())
      .get('/file-renames')
      .query({ status: 'applied' })
      .expect(200);

    expect(videoDb.listFileRenames).toHaveBeenCalledWith(undefined, {
      status: 'applied',
    });
  });

  it('logs the error and returns a generic message when listing fails', async () => {
    const dbError = new Error('connection refused');
    (videoDb.listFileRenames as jest.Mock).mockRejectedValue(dbError);

    const res = await supertest(createServer())
      .get('/file-renames')
      .expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'GET /file-renames failed:',
      dbError,
    );
  });
});

describe('DELETE /file-renames', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  it('rejects a missing season without touching the database', async () => {
    const res = await supertest(createServer())
      .delete('/file-renames')
      .expect(400);

    expect(res.body.message).toBe('Invalid query parameters');
    expect(videoDb.deleteFileRenamesBySeason).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric season without touching the database', async () => {
    const res = await supertest(createServer())
      .delete('/file-renames')
      .query({ season: 'bogus' })
      .expect(400);

    expect(res.body.message).toBe('Invalid query parameters');
    expect(videoDb.deleteFileRenamesBySeason).not.toHaveBeenCalled();
  });

  it('deletes the season and returns the deleted count', async () => {
    (videoDb.deleteFileRenamesBySeason as jest.Mock).mockResolvedValue([
      { id: 'fr-1' },
      { id: 'fr-2' },
    ]);

    const res = await supertest(createServer())
      .delete('/file-renames')
      .query({ season: 3 })
      .expect(200);

    expect(videoDb.deleteFileRenamesBySeason).toHaveBeenCalledWith(
      undefined,
      3,
    );
    expect(res.body).toEqual({ deletedCount: 2 });
  });

  it('logs the error and returns a generic message when deletion fails', async () => {
    const dbError = new Error('connection refused');
    (videoDb.deleteFileRenamesBySeason as jest.Mock).mockRejectedValue(dbError);

    const res = await supertest(createServer())
      .delete('/file-renames')
      .query({ season: 3 })
      .expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'DELETE /file-renames failed:',
      dbError,
    );
  });
});

describe('DELETE /file-renames/:id', () => {
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
      .delete('/file-renames/not-a-uuid')
      .expect(400);

    expect(res.body.message).toBe('Invalid request parameters');
    expect(videoDb.deleteFileRenameById).not.toHaveBeenCalled();
  });

  it('returns 404 when no file rename matches the id', async () => {
    (videoDb.deleteFileRenameById as jest.Mock).mockResolvedValue(undefined);

    const res = await supertest(createServer())
      .delete(`/file-renames/${VALID_ID}`)
      .expect(404);

    expect(res.body).toEqual({ message: 'file rename not found' });
  });

  it('deletes the file rename and returns it', async () => {
    const deleted = { id: VALID_ID, status: 'pending' };
    (videoDb.deleteFileRenameById as jest.Mock).mockResolvedValue(deleted);

    const res = await supertest(createServer())
      .delete(`/file-renames/${VALID_ID}`)
      .expect(200);

    expect(videoDb.deleteFileRenameById).toHaveBeenCalledWith(
      undefined,
      VALID_ID,
    );
    expect(res.body).toEqual(deleted);
  });

  it('logs the error and returns a generic message when deletion fails', async () => {
    const dbError = new Error('connection refused');
    (videoDb.deleteFileRenameById as jest.Mock).mockRejectedValue(dbError);

    const res = await supertest(createServer())
      .delete(`/file-renames/${VALID_ID}`)
      .expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `DELETE /file-renames/${VALID_ID} failed:`,
      dbError,
    );
  });
});
