import fs from 'fs';
import os from 'os';
import supertest from 'supertest';
import * as videoDb from '@abbottland/video-db';
import { createServer } from '../../src/server';
import { initConfig } from '../../src/config';
import { hashFile } from '../../src/lib/file-hash';

jest.mock('fs');
jest.mock('../../src/lib/file-hash');
// Partial mock: keep real value exports (e.g. fileRenameSelectSchema, which
// openapi.ts needs to build the doc at module-load time) and only mock the
// query functions under test here.
jest.mock('@abbottland/video-db', () => ({
  ...jest.requireActual('@abbottland/video-db'),
  upsertFileRename: jest.fn(),
  getFileRenameById: jest.fn(),
  updateFileRenameStatus: jest.fn(),
  listFileRenames: jest.fn(),
}));

const sampleFileRename = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  fileHash: 'deadbeef',
  originalFilePath: '/videos/example.mp4',
  suggestedFilePath: '/videos/Show A - S01E01.mp4',
  status: 'pending',
  createdAt: new Date(),
  appliedAt: null,
};

describe('POST /file-renames', () => {
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

  it('rejects a suggestedFilePath that escapes MEDIA_ROOT', async () => {
    const res = await supertest(createServer())
      .post('/file-renames')
      .send({
        originalFilePath: '/videos/example.mp4',
        suggestedFilePath: '../../etc/passwd',
      })
      .expect(400);

    expect(res.body.message).toContain('outside');
    expect(videoDb.upsertFileRename).not.toHaveBeenCalled();
  });

  it('rejects an originalFilePath that escapes MEDIA_ROOT', async () => {
    const res = await supertest(createServer())
      .post('/file-renames')
      .send({
        originalFilePath: '../../etc/passwd',
        suggestedFilePath: '/videos/example.mp4',
      })
      .expect(400);

    expect(res.body.message).toContain('outside');
    expect(videoDb.upsertFileRename).not.toHaveBeenCalled();
  });

  it('returns 404 when originalFilePath does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const res = await supertest(createServer())
      .post('/file-renames')
      .send({
        originalFilePath: '/videos/missing.mp4',
        suggestedFilePath: '/videos/Show A - S01E01.mp4',
      })
      .expect(404);

    expect(res.body.message).toBe('file not found');
    expect(videoDb.upsertFileRename).not.toHaveBeenCalled();
  });

  it('hashes originalFilePath and upserts a suggestion', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (hashFile as jest.Mock).mockResolvedValue('deadbeef');
    (videoDb.upsertFileRename as jest.Mock).mockResolvedValue(sampleFileRename);

    const res = await supertest(createServer())
      .post('/file-renames')
      .send({
        originalFilePath: '/videos/example.mp4',
        suggestedFilePath: '/videos/Show A - S01E01.mp4',
      })
      .expect(201);

    expect(hashFile).toHaveBeenCalledWith(
      expect.stringContaining('example.mp4'),
    );
    expect(videoDb.upsertFileRename).toHaveBeenCalledWith(undefined, {
      fileHash: 'deadbeef',
      originalFilePath: '/videos/example.mp4',
      suggestedFilePath: '/videos/Show A - S01E01.mp4',
    });
    expect(res.body.fileHash).toBe('deadbeef');
  });

  it('logs the error and returns a generic message when the upsert fails', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (hashFile as jest.Mock).mockResolvedValue('deadbeef');
    const dbError = new Error('connection refused');
    (videoDb.upsertFileRename as jest.Mock).mockRejectedValue(dbError);

    const res = await supertest(createServer())
      .post('/file-renames')
      .send({
        originalFilePath: '/videos/example.mp4',
        suggestedFilePath: '/videos/Show A - S01E01.mp4',
      })
      .expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'POST /file-renames failed:',
      dbError,
    );
  });
});

describe('GET /file-renames/:id', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  it('returns the file rename for a known id', async () => {
    (videoDb.getFileRenameById as jest.Mock).mockResolvedValue(
      sampleFileRename,
    );

    await supertest(createServer())
      .get(`/file-renames/${sampleFileRename.id}`)
      .expect(200)
      .then((res) => {
        expect(res.body.fileHash).toBe('deadbeef');
      });
  });

  it('returns 404 for an unknown id', async () => {
    (videoDb.getFileRenameById as jest.Mock).mockResolvedValue(undefined);

    await supertest(createServer())
      .get('/file-renames/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('logs the error and returns a generic message when lookup fails', async () => {
    const dbError = new Error('connection refused');
    (videoDb.getFileRenameById as jest.Mock).mockRejectedValue(dbError);

    const res = await supertest(createServer())
      .get(`/file-renames/${sampleFileRename.id}`)
      .expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('GET /file-renames/'),
      dbError,
    );
  });
});

describe('GET /file-renames', () => {
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
    (videoDb.listFileRenames as jest.Mock).mockResolvedValue([
      sampleFileRename,
    ]);

    await supertest(createServer())
      .get('/file-renames')
      .expect(200)
      .then((res) => {
        expect(res.body.fileRenames).toHaveLength(1);
      });

    expect(videoDb.listFileRenames).toHaveBeenCalledWith(undefined, {
      fileHash: undefined,
      status: undefined,
    });
  });

  it('filters by status', async () => {
    (videoDb.listFileRenames as jest.Mock).mockResolvedValue([]);

    await supertest(createServer())
      .get('/file-renames')
      .query({ status: 'pending' })
      .expect(200);

    expect(videoDb.listFileRenames).toHaveBeenCalledWith(undefined, {
      fileHash: undefined,
      status: 'pending',
    });
  });

  it('rejects an unsupported status', async () => {
    await supertest(createServer())
      .get('/file-renames')
      .query({ status: 'bogus' })
      .expect(400);

    expect(videoDb.listFileRenames).not.toHaveBeenCalled();
  });

  it('resolves and hashes a supplied filePath', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (hashFile as jest.Mock).mockResolvedValue('deadbeef');
    (videoDb.listFileRenames as jest.Mock).mockResolvedValue([]);

    await supertest(createServer())
      .get('/file-renames')
      .query({ filePath: '/videos/example.mp4' })
      .expect(200);

    expect(hashFile).toHaveBeenCalledWith(
      expect.stringContaining('example.mp4'),
    );
    expect(videoDb.listFileRenames).toHaveBeenCalledWith(undefined, {
      fileHash: 'deadbeef',
      status: undefined,
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

describe('PATCH /file-renames/:id', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  it('updates the status', async () => {
    (videoDb.updateFileRenameStatus as jest.Mock).mockResolvedValue({
      ...sampleFileRename,
      status: 'applied',
      appliedAt: new Date(),
    });

    const res = await supertest(createServer())
      .patch(`/file-renames/${sampleFileRename.id}`)
      .send({ status: 'applied' })
      .expect(200);

    expect(videoDb.updateFileRenameStatus).toHaveBeenCalledWith(
      undefined,
      sampleFileRename.id,
      'applied',
    );
    expect(res.body.status).toBe('applied');
  });

  it('rejects an unsupported status', async () => {
    await supertest(createServer())
      .patch(`/file-renames/${sampleFileRename.id}`)
      .send({ status: 'bogus' })
      .expect(400);

    expect(videoDb.updateFileRenameStatus).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown id', async () => {
    (videoDb.updateFileRenameStatus as jest.Mock).mockResolvedValue(undefined);

    await supertest(createServer())
      .patch('/file-renames/00000000-0000-0000-0000-000000000000')
      .send({ status: 'rejected' })
      .expect(404);
  });

  it('logs the error and returns a generic message when the update fails', async () => {
    const dbError = new Error('connection refused');
    (videoDb.updateFileRenameStatus as jest.Mock).mockRejectedValue(dbError);

    const res = await supertest(createServer())
      .patch(`/file-renames/${sampleFileRename.id}`)
      .send({ status: 'applied' })
      .expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('PATCH /file-renames/'),
      dbError,
    );
  });
});
