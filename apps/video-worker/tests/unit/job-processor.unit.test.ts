import {
  completeVideoJob,
  failVideoJob,
  heartbeatVideoJob,
} from '@abbottland/video-db';
import type { VideoJob } from '@abbottland/video-db';
import { processJob } from '../../src/worker/job-processor';
import { operationHandlers } from '../../src/worker/operations';

jest.mock('@abbottland/video-db', () => ({
  completeVideoJob: jest.fn(),
  failVideoJob: jest.fn(),
  heartbeatVideoJob: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/worker/operations', () => ({
  operationHandlers: { screenshots: jest.fn() },
}));
jest.mock('../../src/db', () => ({ db: {} }));

const buildJob = (overrides: Partial<VideoJob> = {}): VideoJob =>
  ({
    id: 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
    operation: 'screenshots',
    status: 'processing',
    inputPath: '/videos/example.mp4',
    outputPaths: null,
    parameters: { timestamps: [30] },
    attempts: 1,
    workerId: 'worker-1',
    createdAt: new Date(),
    startedAt: new Date(),
    completedAt: null,
    heartbeatAt: new Date(),
    error: null,
    ...overrides,
  }) as VideoJob;

describe('processJob', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('fails the job for an unsupported operation without invoking a handler', async () => {
    const job = buildJob({ operation: 'transcode' });

    await processJob(job);

    expect(failVideoJob).toHaveBeenCalledWith(
      {},
      job.id,
      expect.stringContaining('unsupported operation'),
    );
    expect(completeVideoJob).not.toHaveBeenCalled();
  });

  it('completes the job with the handler output paths on success', async () => {
    const job = buildJob();
    (operationHandlers.screenshots as jest.Mock).mockResolvedValue([
      '/screenshots/x/30.jpg',
    ]);

    await processJob(job);

    expect(completeVideoJob).toHaveBeenCalledWith({}, job.id, [
      '/screenshots/x/30.jpg',
    ]);
    expect(failVideoJob).not.toHaveBeenCalled();
  });

  it('fails the job with the handler error message', async () => {
    const job = buildJob();
    (operationHandlers.screenshots as jest.Mock).mockRejectedValue(
      new Error('boom'),
    );

    await processJob(job);

    expect(failVideoJob).toHaveBeenCalledWith({}, job.id, 'boom');
  });

  it('sends periodic heartbeats while the handler is still running', async () => {
    jest.useFakeTimers();
    const job = buildJob();
    let resolveHandler!: (paths: string[]) => void;
    (operationHandlers.screenshots as jest.Mock).mockImplementation(
      () =>
        new Promise<string[]>((resolve) => {
          resolveHandler = resolve;
        }),
    );

    const processing = processJob(job);
    await jest.advanceTimersByTimeAsync(25_000);
    expect(heartbeatVideoJob).toHaveBeenCalledTimes(2);

    resolveHandler([]);
    await processing;
    jest.useRealTimers();
  });
});
