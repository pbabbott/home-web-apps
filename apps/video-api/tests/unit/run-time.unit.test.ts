import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import supertest from 'supertest';
import { createServer } from '../../src/server';
import { initConfig } from '../../src/config';

jest.mock('fs');
jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

describe('GET /run-time', () => {
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
      .get('/run-time')
      .query({ filePath: '../../etc/passwd' })
      .expect(400);

    expect(res.body.message).toContain('outside');
    expect(execFile).not.toHaveBeenCalled();
  });

  it('returns 404 when the file does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const res = await supertest(createServer())
      .get('/run-time')
      .query({ filePath: '/videos/missing.mp4' })
      .expect(404);

    expect(res.body.message).toBe('file not found');
    expect(execFile).not.toHaveBeenCalled();
  });

  it('returns the probed runtime, rounded to whole seconds', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (execFile as unknown as jest.Mock).mockImplementation(
      (_file, _args, callback) => callback(null, { stdout: '659.876000\n' }),
    );

    const res = await supertest(createServer())
      .get('/run-time')
      .query({ filePath: '/videos/example.mp4' })
      .expect(200);

    expect(execFile).toHaveBeenCalledWith(
      'ffprobe',
      expect.arrayContaining([expect.stringContaining('example.mp4')]),
      expect.any(Function),
    );
    expect(res.body).toEqual({
      filePath: '/videos/example.mp4',
      runTimeSeconds: 660,
    });
  });

  it('rejects a missing filePath', async () => {
    await supertest(createServer()).get('/run-time').expect(400);

    expect(execFile).not.toHaveBeenCalled();
  });

  it('logs the error and returns a generic message when probing fails', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    const probeError = new Error('ffprobe exploded');
    (execFile as unknown as jest.Mock).mockImplementation(
      (_file, _args, callback) => callback(probeError),
    );

    const res = await supertest(createServer())
      .get('/run-time')
      .query({ filePath: '/videos/example.mp4' })
      .expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'GET /run-time failed:',
      probeError,
    );
  });
});
