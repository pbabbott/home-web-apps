import { markBackupDestinationUnhealthy } from '@abbottland/homelab-db';
import { config } from '../config';
import { db } from '../db';
import { PauseTracker } from '../copy/pause-tracker';
import { workerId } from '../worker-id';
import { DestinationWatchdog } from './watchdog';

export { workerId };

/** Backoff for paused jobs and an unhealthy destination, shared by the poll loop and the copy. */
export const runtimePauses = new PauseTracker();

let watchdog: DestinationWatchdog | undefined;

/** The process-wide watchdog; a stalled destination call marks it unhealthy. */
export const getWatchdog = (): DestinationWatchdog => {
  watchdog ??= new DestinationWatchdog(
    config.backupStallTimeoutSeconds * 1000,
    (operation) => {
      console.error(`❌ destination call stalled: ${operation}`);
      void markBackupDestinationUnhealthy(db, config.backupDestinationId, {
        workerId,
        reason: `watchdog: ${operation} made no progress for ${config.backupStallTimeoutSeconds}s`,
      }).catch((err) =>
        console.error('❌ could not mark the destination unhealthy:', err),
      );
    },
  );

  return watchdog;
};
