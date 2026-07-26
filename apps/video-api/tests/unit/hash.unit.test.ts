import fs from 'fs';
import os from 'os';
import supertest from 'supertest';
import { createServer } from '../../src/server';
import { initConfig } from '../../src/config';
import { hashFile } from '../../src/lib/file-hash';

jest.mock('fs');
jest.mock('../../src/lib/file-hash');

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
