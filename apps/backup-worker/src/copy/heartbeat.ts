import { BackupError, heartbeatBackupItem } from '@abbottland/homelab-db';
import type { Database } from '@abbottland/homelab-db';
import { ClaimLostError } from './errors';

export type HeartbeatHandle = {
  /** Aborted with a `ClaimLostError` once the database says the lease is gone. */
  signal: AbortSignal;
  stop: () => void;
};

/**
 * Extends the lease of a claimed item every `intervalMs` while it is worked
 * on, including while a large file is hashed (a timer runs beside the copy).
 * A rejected heartbeat (cancelled job, expired lease) aborts the signal so the
 * copy stops. A database hiccup is logged; the lease then simply runs down.
 * While `shouldBeat` says no (a destination call has stalled) the lease is
 * left to run down on purpose: the item is hung on a mount that does not
 * answer, and only the lease expiring frees it for another attempt.
 */
export const startHeartbeat = (
  db: Database,
  item: { id: string; claimToken: string },
  options: {
    leaseSeconds: number;
    intervalMs: number;
    /** False skips this beat: a stalled destination call must not keep the lease alive. */
    shouldBeat?: () => boolean;
  },
): HeartbeatHandle => {
  const controller = new AbortController();
  const timer = setInterval(() => {
    if (options.shouldBeat && !options.shouldBeat()) {
      console.error(
        `⚠️  not extending the lease of item ${item.id}: a destination call is stalled`,
      );

      return;
    }
    heartbeatBackupItem(db, item.id, {
      claimToken: item.claimToken,
      leaseSeconds: options.leaseSeconds,
    }).catch((err) => {
      if (err instanceof BackupError) {
        controller.abort(new ClaimLostError(err.message));
      } else {
        console.error('❌ heartbeat failed:', err);
      }
    });
  }, options.intervalMs);

  return {
    signal: controller.signal,
    stop: () => clearInterval(timer),
  };
};
