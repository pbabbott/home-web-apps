import * as homelabDb from '@abbottland/homelab-db';
import { ClaimLostError } from '../../src/copy/errors';
import { startHeartbeat } from '../../src/copy/heartbeat';

jest.mock('@abbottland/homelab-db', () => ({
  ...jest.requireActual('@abbottland/homelab-db'),
  heartbeatBackupItem: jest.fn(),
}));

const mocked = homelabDb as unknown as Record<string, jest.Mock>;
const item = { id: 'item-1', claimToken: 'token' };
const options = { leaseSeconds: 300, intervalMs: 1000 };

describe('startHeartbeat', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation();
    mocked.heartbeatBackupItem.mockResolvedValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('extends the lease every interval until stopped', async () => {
    const heartbeat = startHeartbeat({} as never, item, options);

    await jest.advanceTimersByTimeAsync(3000);
    heartbeat.stop();
    await jest.advanceTimersByTimeAsync(3000);

    expect(mocked.heartbeatBackupItem).toHaveBeenCalledTimes(3);
    expect(mocked.heartbeatBackupItem).toHaveBeenCalledWith({}, 'item-1', {
      claimToken: 'token',
      leaseSeconds: 300,
    });
  });

  it('does not extend the lease while shouldBeat says no, and goes on when it says yes', async () => {
    let allowed = false;
    const heartbeat = startHeartbeat({} as never, item, {
      ...options,
      shouldBeat: () => allowed,
    });

    await jest.advanceTimersByTimeAsync(3000);
    expect(mocked.heartbeatBackupItem).not.toHaveBeenCalled();

    allowed = true;
    await jest.advanceTimersByTimeAsync(1000);
    heartbeat.stop();

    expect(mocked.heartbeatBackupItem).toHaveBeenCalledTimes(1);
  });

  it('aborts the signal with a ClaimLostError when the lease is rejected', async () => {
    mocked.heartbeatBackupItem.mockRejectedValue(
      new homelabDb.BackupError('conflict', 'job is cancelled'),
    );
    const heartbeat = startHeartbeat({} as never, item, options);

    await jest.advanceTimersByTimeAsync(1000);
    heartbeat.stop();

    expect(heartbeat.signal.aborted).toBe(true);
    expect(heartbeat.signal.reason).toBeInstanceOf(ClaimLostError);
  });
});
