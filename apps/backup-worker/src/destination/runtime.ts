import { config } from '../config';
import path from 'path';
import { DestFs, defaultDestFsDeps, type DestFsDeps } from '../copy/dest-fs';
import { PauseTracker } from '../copy/pause-tracker';
import { pauseDestination } from '../copy/pauses';
import { workerId } from '../worker-id';
import { DestinationWatchdog } from './watchdog';

export { workerId };

/** Backoff for paused jobs and an unhealthy destination, shared by the poll loop and the copy. */
export const runtimePauses = new PauseTracker();

let watchdog: DestinationWatchdog | undefined;
let stallListener: ((operation: string) => void) | undefined;

/**
 * Called when a destination call stalls, so the copy in flight can abort. The
 * listener is removed by the function this returns.
 */
export const onDestinationStall = (
  listener: (operation: string) => void,
): (() => void) => {
  stallListener = listener;

  return () => {
    if (stallListener === listener) stallListener = undefined;
  };
};

const createWatchdog = (stallTimeoutMs: number): DestinationWatchdog =>
  new DestinationWatchdog(stallTimeoutMs, (operation) => {
    console.error(`❌ destination call stalled: ${operation}`);
    stallListener?.(operation);
    void pauseDestination(
      runtimePauses,
      `watchdog: ${operation} made no progress for ${Math.round(stallTimeoutMs / 1000)}s`,
    ).catch((err) => console.error('❌ could not pause the destination:', err));
  });

/**
 * The process-wide watchdog. A stalled destination call aborts the item in
 * flight (its heartbeats stop, see `startHeartbeat`), marks the destination
 * unhealthy and pauses its jobs; /readyz then fails and the pod is restarted.
 */
export const getWatchdog = (): DestinationWatchdog => {
  watchdog ??= createWatchdog(config.backupStallTimeoutSeconds * 1000);

  return watchdog;
};

/** Replaces the watchdog, for tests that need a short stall timeout. */
export const resetWatchdogForTests = (stallTimeoutMs?: number): void => {
  watchdog = createWatchdog(
    stallTimeoutMs ?? config.backupStallTimeoutSeconds * 1000,
  );
};

/** The destination's filesystem, every call under the watchdog unless `fsDeps` replaces it. */
export const makeDestFs = (
  rootDir: string | null | undefined,
  fsDeps?: DestFsDeps,
): DestFs =>
  new DestFs(
    config.backupDestinationPath,
    path.join(config.backupDestinationPath, rootDir ?? ''),
    fsDeps ??
      defaultDestFsDeps((operation, fn) => getWatchdog().run(operation, fn)),
  );
