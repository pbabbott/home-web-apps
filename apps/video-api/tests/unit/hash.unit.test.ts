import fs from 'fs';
import os from 'os';
import supertest from 'supertest';
import { hashFile } from '@abbottland/video-db';
import { createServer } from '../../src/server';
import { initConfig } from '../../src/config';

jest.mock('fs');
// Partial mock: keep real value exports (e.g. select schemas, which
// openapi.ts needs to build the doc at module-load time) and only mock
// hashFile under test here.
jest.mock('@abbottland/video-db', () => ({
  ...jest.requireActual('@abbottland/video-db'),
  hashFile: jest.fn(),
}));

describe('GET /hash', () => {
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
      .get('/hash')
      .query({ filePath: '../../etc/passwd' })
      .expect(400);

    expect(res.body.message).toContain('outside');
    expect(hashFile).not.toHaveBeenCalled();
  });

  it('returns 404 when the file does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const res = await supertest(createServer())
      .get('/hash')
      .query({ filePath: '/videos/missing.mp4' })
      .expect(404);

    expect(res.body.message).toBe('file not found');
    expect(hashFile).not.toHaveBeenCalled();
  });

  it('returns the computed hash', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (hashFile as jest.Mock).mockResolvedValue('deadbeef');

    const res = await supertest(createServer())
      .get('/hash')
      .query({ filePath: '/videos/example.mp4' })
      .expect(200);

    expect(hashFile).toHaveBeenCalledWith(
      expect.stringContaining('example.mp4'),
    );
    expect(res.body).toEqual({
      filePath: '/videos/example.mp4',
      fileHash: 'deadbeef',
    });
  });

  it('rejects a missing filePath', async () => {
    await supertest(createServer()).get('/hash').expect(400);

    expect(hashFile).not.toHaveBeenCalled();
  });

  it('logs the error and returns a generic message when hashing fails', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    const hashError = new Error('EIO: i/o error');
    (hashFile as jest.Mock).mockRejectedValue(hashError);

    const res = await supertest(createServer())
      .get('/hash')
      .query({ filePath: '/videos/example.mp4' })
      .expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'GET /hash failed:',
      hashError,
    );
  });
});
