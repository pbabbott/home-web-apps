import fs from 'fs/promises';
import os from 'os';
import supertest from 'supertest';
import { createServer } from '../../src/server';
import { initConfig } from '../../src/config';

jest.mock('fs/promises');

describe('GET /browse error handling', () => {
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

  it('logs the error and returns a generic message for unexpected fs errors', async () => {
    const fsError = new Error('EACCES: permission denied');
    (fs.stat as jest.Mock).mockRejectedValue(fsError);

    const res = await supertest(createServer()).get('/browse').expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('GET /browse'),
      fsError,
    );
  });
});
