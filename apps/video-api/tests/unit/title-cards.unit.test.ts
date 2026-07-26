import fs from 'fs';
import os from 'os';
import supertest from 'supertest';
import * as videoDb from '@abbottland/video-db';
import { createServer } from '../../src/server';
import { initConfig } from '../../src/config';
import { hashFile } from '../../src/lib/file-hash';

jest.mock('fs');
jest.mock('../../src/lib/file-hash');
// Partial mock: keep real value exports (e.g. titleCardSelectSchema, which
// openapi.ts needs to build the doc at module-load time) and only mock the
// query functions under test here.
jest.mock('@abbottland/video-db', () => ({
  ...jest.requireActual('@abbottland/video-db'),
  upsertTitleCard: jest.fn(),
  getTitleCardById: jest.fn(),
  listTitleCards: jest.fn(),
}));

const sampleTitleCard = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  fileHash: 'deadbeef',
  filePath: '/videos/example.mp4',
  timestampSeconds: 30,
  title: null,
  screenshotPath: null,
  createdAt: new Date(),
};

describe('POST /title-cards', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(async () => {
    process.env.MEDIA_ROOT = os.tmpdir();
    await initConfig();
  });

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  it('rejects a filePath that escapes MEDIA_ROOT', async () => {
    const res = await supertest(createServer())
      .post('/title-cards')
      .send({ filePath: '../../etc/passwd', timestampSeconds: 30 })
      .expect(400);

    expect(res.body.message).toContain('outside');
    expect(videoDb.upsertTitleCard).not.toHaveBeenCalled();
  });

  it('returns 404 when the file does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const res = await supertest(createServer())
      .post('/title-cards')
      .send({ filePath: '/videos/example.mp4', timestampSeconds: 30 })
      .expect(404);

    expect(res.body.message).toBe('file not found');
    expect(hashFile).not.toHaveBeenCalled();
    expect(videoDb.upsertTitleCard).not.toHaveBeenCalled();
  });

  it('hashes the file and upserts a title card', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (hashFile as jest.Mock).mockResolvedValue('deadbeef');
    (videoDb.upsertTitleCard as jest.Mock).mockResolvedValue(sampleTitleCard);

    const res = await supertest(createServer())
      .post('/title-cards')
      .send({ filePath: '/videos/example.mp4', timestampSeconds: 30 })
      .expect(201);

    expect(hashFile).toHaveBeenCalledWith(
      expect.stringContaining('example.mp4'),
    );
    expect(videoDb.upsertTitleCard).toHaveBeenCalledWith(undefined, {
      fileHash: 'deadbeef',
      filePath: '/videos/example.mp4',
      timestampSeconds: 30,
      title: undefined,
      screenshotPath: undefined,
    });
    expect(res.body.fileHash).toBe('deadbeef');
  });

  it('logs the error and returns a generic message when the upsert fails', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (hashFile as jest.Mock).mockResolvedValue('deadbeef');
    const dbError = new Error('connection refused');
    (videoDb.upsertTitleCard as jest.Mock).mockRejectedValue(dbError);

    const res = await supertest(createServer())
      .post('/title-cards')
      .send({ filePath: '/videos/example.mp4', timestampSeconds: 30 })
      .expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'POST /title-cards failed:',
      dbError,
    );
  });
});

describe('GET /title-cards/:id', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  it('returns the title card for a known id', async () => {
    (videoDb.getTitleCardById as jest.Mock).mockResolvedValue(sampleTitleCard);

    await supertest(createServer())
      .get(`/title-cards/${sampleTitleCard.id}`)
      .expect(200)
      .then((res) => {
        expect(res.body.fileHash).toBe('deadbeef');
      });
  });

  it('returns 404 for an unknown id', async () => {
    (videoDb.getTitleCardById as jest.Mock).mockResolvedValue(undefined);

    await supertest(createServer())
      .get('/title-cards/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('returns 400, not 500, for a malformed id', async () => {
    await supertest(createServer())
      .get('/title-cards/not-a-uuid')
      .expect(400)
      .then((res) => {
        expect(res.body.message).toBe('Invalid request parameters');
      });

    expect(videoDb.getTitleCardById).not.toHaveBeenCalled();
  });

  it('logs the error and returns a generic message when lookup fails', async () => {
    const dbError = new Error('connection refused');
    (videoDb.getTitleCardById as jest.Mock).mockRejectedValue(dbError);

    const res = await supertest(createServer())
      .get(`/title-cards/${sampleTitleCard.id}`)
      .expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('GET /title-cards/'),
      dbError,
    );
  });
});

describe('GET /title-cards', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(async () => {
    process.env.MEDIA_ROOT = os.tmpdir();
    await initConfig();
  });

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  it('lists everything when no filter is given', async () => {
    (videoDb.listTitleCards as jest.Mock).mockResolvedValue([sampleTitleCard]);

    await supertest(createServer())
      .get('/title-cards')
      .expect(200)
      .then((res) => {
        expect(res.body.titleCards).toHaveLength(1);
      });

    expect(videoDb.listTitleCards).toHaveBeenCalledWith(undefined, {
      fileHash: undefined,
    });
    expect(hashFile).not.toHaveBeenCalled();
  });

  it('uses a supplied fileHash directly, without touching the filesystem', async () => {
    (videoDb.listTitleCards as jest.Mock).mockResolvedValue([]);

    await supertest(createServer())
      .get('/title-cards')
      .query({ fileHash: 'deadbeef' })
      .expect(200);

    expect(videoDb.listTitleCards).toHaveBeenCalledWith(undefined, {
      fileHash: 'deadbeef',
    });
    expect(hashFile).not.toHaveBeenCalled();
  });

  it('resolves and hashes a supplied filePath', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (hashFile as jest.Mock).mockResolvedValue('deadbeef');
    (videoDb.listTitleCards as jest.Mock).mockResolvedValue([]);

    await supertest(createServer())
      .get('/title-cards')
      .query({ filePath: '/videos/example.mp4' })
      .expect(200);

    expect(hashFile).toHaveBeenCalledWith(
      expect.stringContaining('example.mp4'),
    );
    expect(videoDb.listTitleCards).toHaveBeenCalledWith(undefined, {
      fileHash: 'deadbeef',
    });
  });

  it('returns 404 when filePath does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    await supertest(createServer())
      .get('/title-cards')
      .query({ filePath: '/videos/missing.mp4' })
      .expect(404);

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
