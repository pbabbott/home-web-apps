import supertest from 'supertest';
import * as videoDb from '@abbottland/video-db';
import { createServer } from '../../src/server';

// Partial mock: keep real value exports (e.g. videoJobSelectSchema, which
// openapi.ts needs to build the doc at module-load time) and only mock the
// query functions under test here.
jest.mock('@abbottland/video-db', () => ({
  ...jest.requireActual('@abbottland/video-db'),
  createVideoJob: jest.fn(),
  getVideoJobById: jest.fn(),
  listVideoJobs: jest.fn(),
}));

describe('POST /jobs error handling', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  it('logs the error and returns a generic message when job creation fails', async () => {
    const dbError = new Error('connection refused');
    (videoDb.createVideoJob as jest.Mock).mockRejectedValue(dbError);

    const res = await supertest(createServer())
      .post('/jobs')
      .send({
        operation: 'screenshots',
        inputPath: '/videos/example.mp4',
        parameters: { timestamps: [30] },
      })
      .expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('POST /jobs failed:', dbError);
  });
});

describe('GET /jobs/:id error handling', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  it('logs the error and returns a generic message when lookup fails', async () => {
    const dbError = new Error('connection refused');
    (videoDb.getVideoJobById as jest.Mock).mockRejectedValue(dbError);

    const res = await supertest(createServer())
      .get('/jobs/00000000-0000-0000-0000-000000000000')
      .expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('GET /jobs/'),
      dbError,
    );
  });
});

describe('GET /jobs', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  it('rejects an unsupported status without touching the database', async () => {
    const res = await supertest(createServer())
      .get('/jobs')
      .query({ status: 'bogus' })
      .expect(400);

    expect(res.body.message).toBe('Invalid query parameters');
    expect(videoDb.listVideoJobs).not.toHaveBeenCalled();
  });

  it('passes a valid status through to listVideoJobs', async () => {
    (videoDb.listVideoJobs as jest.Mock).mockResolvedValue([]);

    await supertest(createServer())
      .get('/jobs')
      .query({ status: 'pending' })
      .expect(200);

    expect(videoDb.listVideoJobs).toHaveBeenCalledWith(undefined, {
      status: 'pending',
    });
  });

  it('logs the error and returns a generic message when listing fails', async () => {
    const dbError = new Error('connection refused');
    (videoDb.listVideoJobs as jest.Mock).mockRejectedValue(dbError);

    const res = await supertest(createServer()).get('/jobs').expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('GET /jobs failed:', dbError);
  });
});
