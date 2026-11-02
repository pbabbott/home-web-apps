import path from 'path';
import { config } from '../config';
import { DestFs, defaultDestFsDeps, type DestFsDeps } from '../copy/dest-fs';
import { PauseTracker } from '../copy/pause-tracker';
import { DestinationWatchdog } from './watchdog';

/**
 * What the poll loop and the copy share for the life of the process. Created
 * once at startup and passed down, so a test builds its own.
 */
export type WorkerRuntime = {
  /** A stalled destination call aborts the item in flight and, with the poll loop's listener, pauses the destination; /readyz then fails and the pod is restarted. */
  watchdog: DestinationWatchdog;
  /** Backoff for paused jobs and an unhealthy destination. */
  pauses: PauseTracker;
};

export const createWorkerRuntime = (): WorkerRuntime => ({
  watchdog: new DestinationWatchdog(config.backupStallTimeoutSeconds * 1000),
  pauses: new PauseTracker(),
});

/** The destination's filesystem, every call under the watchdog unless `fsDeps` replaces it. */
export const makeDestFs = (
  watchdog: DestinationWatchdog,
  rootDir: string | null | undefined,
  fsDeps?: DestFsDeps,
): DestFs =>
  new DestFs(
    config.backupDestinationPath,
    path.join(config.backupDestinationPath, rootDir ?? ''),
    fsDeps ?? defaultDestFsDeps((operation, fn) => watchdog.run(operation, fn)),
  );
