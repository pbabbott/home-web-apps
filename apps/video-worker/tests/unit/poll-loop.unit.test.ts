const claimNextVideoJob = jest.fn();
const processJob = jest.fn();

describe('poll loop', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    claimNextVideoJob.mockReset();
    processJob.mockReset();

    jest.doMock('@abbottland/video-db', () => ({ claimNextVideoJob }));
    jest.doMock('../../src/db', () => ({ db: {} }));
    jest.doMock('../../src/config', () => ({
      config: { pollIntervalMs: 5000 },
    }));
    jest.doMock('../../src/worker/job-processor', () => ({ processJob }));

    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('claims and processes a pending job, then immediately polls again', async () => {
    const job = { id: 'job-1', operation: 'screenshots' };
    claimNextVideoJob
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce(undefined);
    processJob.mockResolvedValue(undefined);

    const { pollOnce, stopPollLoop } = require('../../src/worker/poll-loop');

    await pollOnce();
    expect(processJob).toHaveBeenCalledWith(job);
    expect(claimNextVideoJob).toHaveBeenCalledTimes(1);

    // the immediate re-poll after a processed job is scheduled via setTimeout(0)
    await jest.advanceTimersByTimeAsync(0);
    expect(claimNextVideoJob).toHaveBeenCalledTimes(2);

    await stopPollLoop();
  });

  it('waits pollIntervalMs before polling again when no job is pending', async () => {
    claimNextVideoJob.mockResolvedValue(undefined);
    const { pollOnce, stopPollLoop } = require('../../src/worker/poll-loop');

    await pollOnce();
    expect(claimNextVideoJob).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(4999);
    expect(claimNextVideoJob).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(claimNextVideoJob).toHaveBeenCalledTimes(2);

    await stopPollLoop();
  });

  it('logs and reschedules after pollIntervalMs when claiming fails', async () => {
    claimNextVideoJob
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValue(undefined);
    const { pollOnce, stopPollLoop } = require('../../src/worker/poll-loop');

    await pollOnce();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('failed to claim'),
      expect.any(Error),
    );

    await jest.advanceTimersByTimeAsync(5000);
    expect(claimNextVideoJob).toHaveBeenCalledTimes(2);

    await stopPollLoop();
  });

  it('stopPollLoop cancels a pending scheduled poll', async () => {
    claimNextVideoJob.mockResolvedValue(undefined);
    const { pollOnce, stopPollLoop } = require('../../src/worker/poll-loop');

    await pollOnce();
    await stopPollLoop();

    await jest.advanceTimersByTimeAsync(10_000);
    expect(claimNextVideoJob).toHaveBeenCalledTimes(1);
  });

  it('stopPollLoop waits for an in-flight job to finish before resolving', async () => {
    const job = { id: 'job-1', operation: 'screenshots' };
    claimNextVideoJob.mockResolvedValueOnce(job).mockResolvedValue(undefined);
    let resolveProcess!: () => void;
    processJob.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveProcess = resolve;
        }),
    );

    const { pollOnce, stopPollLoop } = require('../../src/worker/poll-loop');

    const pollPromise = pollOnce();
    while (processJob.mock.calls.length === 0) {
      await Promise.resolve();
    }

    let stopped = false;
    const stopPromise = stopPollLoop().then(() => {
      stopped = true;
    });

    await Promise.resolve();
    expect(stopped).toBe(false);

    resolveProcess();
    await pollPromise;
    await stopPromise;
    expect(stopped).toBe(true);
  });
});
