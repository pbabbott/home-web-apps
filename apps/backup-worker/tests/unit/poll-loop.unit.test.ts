import * as homelabDb from '@abbottland/homelab-db';
import * as pauses from '../../src/copy/pauses';
import * as staging from '../../src/copy/staging-cleanup';
import { DESTINATION_KEY } from '../../src/copy/pause-tracker';
import { runtimePauses } from '../../src/destination/runtime';
import * as validate from '../../src/destination/validate';
import { startPollLoop, stopPollLoop } from '../../src/worker/poll-loop';

jest.mock('@abbottland/homelab-db', () => ({
  ...jest.requireActual('@abbottland/homelab-db'),
  touchBackupDestinationWorker: jest.fn(),
  getBackupDestination: jest.fn(),
  recordBackupDestinationValidation: jest.fn(),
  claimNextBackupItem: jest.fn(),
  completeBackupJobIfDone: jest.fn(),
  markBackupDestinationUnhealthy: jest.fn(),
}));

jest.mock('../../src/db', () => ({ db: {} }));

// Real file I/O would not settle under fake timers.
jest.mock('../../src/copy/staging-cleanup', () => ({
  removeStaleStaging: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../src/copy/pauses', () => ({
  resumeReachableSources: jest.fn(),
  resumeDestinationJobs: jest.fn(),
  stallDestinationJobs: jest.fn(),
  pauseDestination: jest.fn(),
  pauseSource: jest.fn(),
}));

jest.mock('../../src/config', () => ({
  config: {
    backupDestinationId: 'dest-1',
    backupDestinationPath: '/backup',
    backupDestinationMountCheck: 'none',
    backupStallTimeoutSeconds: 120,
    pollIntervalMs: 1000,
  },
}));

const mocked = homelabDb as unknown as Record<string, jest.Mock>;

describe('poll loop', () => {
  let validateSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    validateSpy = jest
      .spyOn(validate, 'validateDestination')
      .mockResolvedValue({
        ok: true,
        mountVerified: false,
        checks: [],
        rootEntries: [],
      });
    mocked.getBackupDestination.mockResolvedValue({
      id: 'dest-1',
      validationRequestedAt: null,
    });
    mocked.claimNextBackupItem.mockResolvedValue({
      item: null,
      reason: 'queue_empty',
      retryAt: null,
      drainedJobIds: [],
    });
  });

  afterEach(async () => {
    await stopPollLoop();
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  const tick = (ms: number) => jest.advanceTimersByTimeAsync(ms);

  describe('an unhealthy destination', () => {
    const unhealthy = {
      id: 'dest-1',
      validationRequestedAt: null,
      health: 'unhealthy',
    };

    beforeEach(() => runtimePauses.reset(DESTINATION_KEY));
    afterEach(() => runtimePauses.reset(DESTINATION_KEY));

    it('is validated again by itself once its backoff is over, not before', async () => {
      startPollLoop();
      await tick(0);
      expect(validateSpy).toHaveBeenCalledTimes(1);

      mocked.getBackupDestination.mockResolvedValue(unhealthy);
      runtimePauses.fail(DESTINATION_KEY);
      await tick(1000);
      expect(validateSpy).toHaveBeenCalledTimes(1);

      await tick(28_000);
      expect(validateSpy).toHaveBeenCalledTimes(1);

      // A passing validation makes the destination healthy again.
      mocked.recordBackupDestinationValidation.mockImplementation(async () => {
        mocked.getBackupDestination.mockResolvedValue({
          ...unhealthy,
          health: 'ok',
        });
      });
      await tick(5000);
      expect(validateSpy).toHaveBeenCalledTimes(2);

      await tick(5000);
      expect(validateSpy).toHaveBeenCalledTimes(2);
    });

    it('resumes its jobs when validation passes and pauses them when it fails', async () => {
      startPollLoop();
      await tick(0);
      expect(pauses.resumeDestinationJobs).toHaveBeenCalledTimes(1);
      expect(pauses.stallDestinationJobs).not.toHaveBeenCalled();

      validateSpy.mockResolvedValue({
        ok: false,
        mountVerified: false,
        checks: [{ name: 'probe', ok: false, message: 'EIO' }],
        rootEntries: [],
      });
      mocked.getBackupDestination.mockResolvedValue({
        ...unhealthy,
        validationRequestedAt: new Date(),
      });
      await tick(1000);

      expect(pauses.stallDestinationJobs).toHaveBeenCalledTimes(1);
      expect(pauses.resumeDestinationJobs).toHaveBeenCalledTimes(1);
    });
  });

  it('removes stale staging after the first validation only', async () => {
    startPollLoop();
    await tick(0);
    expect(staging.removeStaleStaging).toHaveBeenCalledTimes(1);

    mocked.getBackupDestination.mockResolvedValue({
      id: 'dest-1',
      validationRequestedAt: new Date(),
    });
    await tick(1000);

    expect(validateSpy).toHaveBeenCalledTimes(2);
    expect(staging.removeStaleStaging).toHaveBeenCalledTimes(1);
  });

  it('touches worker_seen_at on every poll', async () => {
    startPollLoop();
    await tick(0);
    await tick(1000);
    await tick(1000);

    expect(mocked.touchBackupDestinationWorker).toHaveBeenCalledTimes(3);
    expect(mocked.touchBackupDestinationWorker).toHaveBeenCalledWith(
      {},
      'dest-1',
    );
  });

  it('validates at startup, then only when a request is pending', async () => {
    startPollLoop();
    await tick(0);

    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(mocked.recordBackupDestinationValidation).toHaveBeenCalledWith(
      {},
      'dest-1',
      expect.objectContaining({
        validation: expect.objectContaining({ ok: true }),
      }),
    );

    await tick(1000);
    expect(validateSpy).toHaveBeenCalledTimes(1);

    mocked.getBackupDestination.mockResolvedValue({
      id: 'dest-1',
      validationRequestedAt: new Date(),
    });
    await tick(1000);
    expect(validateSpy).toHaveBeenCalledTimes(2);
  });

  it('claims once per poll when there is nothing to copy', async () => {
    startPollLoop();
    await tick(0);
    await tick(1000);

    expect(mocked.claimNextBackupItem).toHaveBeenCalledTimes(2);
    expect(mocked.claimNextBackupItem).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ destinationId: 'dest-1' }),
    );
  });

  it('runs the completion check for every drained job', async () => {
    mocked.claimNextBackupItem.mockResolvedValue({
      item: null,
      reason: 'queue_empty',
      retryAt: null,
      drainedJobIds: ['job-1', 'job-2'],
    });
    startPollLoop();
    await tick(0);

    expect(mocked.completeBackupJobIfDone).toHaveBeenCalledWith(
      {},
      'job-1',
      expect.objectContaining({ type: 'system' }),
    );
    expect(mocked.completeBackupJobIfDone).toHaveBeenCalledWith(
      {},
      'job-2',
      expect.objectContaining({ type: 'system' }),
    );
  });

  it('does not claim when the destination row is missing', async () => {
    mocked.getBackupDestination.mockResolvedValue(undefined);
    startPollLoop();
    await tick(2000);

    expect(mocked.claimNextBackupItem).not.toHaveBeenCalled();
  });

  it('keeps polling when the destination row is missing', async () => {
    mocked.getBackupDestination.mockResolvedValue(undefined);
    startPollLoop();
    await tick(2000);

    expect(validateSpy).not.toHaveBeenCalled();
    expect(mocked.touchBackupDestinationWorker).toHaveBeenCalledTimes(3);
  });

  it('survives a database error and polls again', async () => {
    mocked.touchBackupDestinationWorker.mockRejectedValueOnce(
      new Error('down'),
    );
    startPollLoop();
    await tick(0);
    await tick(1000);

    expect(mocked.touchBackupDestinationWorker).toHaveBeenCalledTimes(2);
  });

  it('stops polling after stopPollLoop', async () => {
    startPollLoop();
    await tick(0);
    await stopPollLoop();
    await tick(5000);

    expect(mocked.touchBackupDestinationWorker).toHaveBeenCalledTimes(1);
  });
});
