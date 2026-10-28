import * as homelabDb from '@abbottland/homelab-db';
import * as validate from '../../src/destination/validate';
import { startPollLoop, stopPollLoop } from '../../src/worker/poll-loop';

jest.mock('@abbottland/homelab-db', () => ({
  ...jest.requireActual('@abbottland/homelab-db'),
  touchBackupDestinationWorker: jest.fn(),
  getBackupDestination: jest.fn(),
  recordBackupDestinationValidation: jest.fn(),
  claimNextBackupItem: jest.fn(),
  markBackupDestinationUnhealthy: jest.fn(),
}));

jest.mock('../../src/db', () => ({ db: {} }));

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
  });

  afterEach(async () => {
    await stopPollLoop();
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  const tick = (ms: number) => jest.advanceTimersByTimeAsync(ms);

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

  it('never claims work', async () => {
    startPollLoop();
    await tick(3000);

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
