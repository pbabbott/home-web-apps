import {
  getBackupDestination,
  getBackupJobItem,
  recordBackupDestinationValidation,
  touchBackupDestinationWorker,
} from '@abbottland/homelab-db';
import { db } from '../db';
import { claimAndCopyNext } from '../copy/run';
import { config, type MountCheck } from '../config';
import { removeStaleStaging } from '../copy/staging-cleanup';
import { DESTINATION_KEY } from '../copy/pause-tracker';
import { resumeDestinationJobs, stallDestinationJobs } from '../copy/pauses';
import {
  getWatchdog,
  makeDestFs,
  runtimePauses,
  workerId,
} from '../destination/runtime';
import { requestShutdown, resetShutdown } from './shutdown';
import {
  defaultValidationDeps,
  validateDestination,
} from '../destination/validate';

export { workerId };

let stopped = false;
let validatedOnce = false;
let pollTimeout: NodeJS.Timeout | undefined;
let currentPoll: Promise<void> | undefined;

const scheduleNextPoll = (delayMs: number) => {
  if (stopped) return;
  pollTimeout = setTimeout(() => {
    currentPoll = pollOnce().finally(() => {
      currentPoll = undefined;
    });
  }, delayMs);
};

/** At startup, deletes staging left by cancelled jobs and killed attempts. */
const cleanStaleStaging = async (rootDir: string | null): Promise<void> => {
  try {
    const removed = await removeStaleStaging(
      makeDestFs(rootDir),
      async (itemId) =>
        (await getBackupJobItem(db, itemId))?.status === 'in_progress',
    );

    if (removed.length > 0) {
      console.log(`🧹 removed stale staging of ${removed.length} item(s)`);
    }
  } catch (err) {
    console.error('⚠️  could not clean stale staging:', err);
  }
};

/**
 * Claims and copies items until there is nothing to claim or one cannot be
 * finished (then the next poll tries again). `worker_seen_at` keeps ticking
 * while an item is copied, so a long copy does not look like a dead worker.
 */
const copyWhileWorkExists = async (): Promise<void> => {
  const keepAlive = setInterval(() => {
    // A worker stuck on a hung mount must look dead, not busy.
    if (getWatchdog().state().stalled) return;
    touchBackupDestinationWorker(db, config.backupDestinationId).catch((err) =>
      console.error('❌ could not report that the worker is alive:', err),
    );
  }, config.pollIntervalMs);

  try {
    while (!stopped) {
      const result = await claimAndCopyNext();

      if (result.kind !== 'settled') return;
    }
  } finally {
    clearInterval(keepAlive);
  }
};

/**
 * One iteration: report that the worker is alive, validate the destination at
 * startup and whenever the API has asked for it, then copy whatever is
 * claimable. A validation request made during a long copy waits for the item
 * to end.
 */
export const pollOnce = async (): Promise<void> => {
  if (stopped) return;

  try {
    await touchBackupDestinationWorker(db, config.backupDestinationId);

    const destination = await getBackupDestination(
      db,
      config.backupDestinationId,
    );

    if (!destination) {
      console.error(
        `❌ backup destination ${config.backupDestinationId} does not exist`,
      );
    } else if (
      !validatedOnce ||
      destination.validationRequestedAt ||
      // An unhealthy destination is checked again by itself, with a backoff.
      (destination.health === 'unhealthy' && runtimePauses.due(DESTINATION_KEY))
    ) {
      const validation = await validateDestination(
        {
          destination,
          mountPath: config.backupDestinationPath,
          mountCheck: config.backupDestinationMountCheck as MountCheck,
        },
        defaultValidationDeps((operation, fn) =>
          getWatchdog().run(operation, fn),
        ),
      );

      await recordBackupDestinationValidation(db, destination.id, {
        workerId,
        validation,
      });
      const firstValidation = !validatedOnce;

      validatedOnce = true;

      if (validation.ok) {
        await resumeDestinationJobs();
        if (firstValidation) await cleanStaleStaging(destination.rootDir);
      } else {
        await stallDestinationJobs(runtimePauses);
      }

      console.log(
        validation.ok
          ? '✅ destination validated'
          : `⚠️  destination validation failed: ${validation.checks
              ?.filter((c) => !c.ok)
              .map((c) => `${c.name}: ${c.message}`)
              .join('; ')}`,
      );
    }

    if (destination) await copyWhileWorkExists();
  } catch (err) {
    console.error('❌ poll failed:', err);
  }

  scheduleNextPoll(config.pollIntervalMs);
};

export const startPollLoop = () => {
  stopped = false;
  validatedOnce = false;
  resetShutdown();
  currentPoll = pollOnce().finally(() => {
    currentPoll = undefined;
  });
};

/**
 * Stops scheduling polls, aborts the transfer in flight (its item is released
 * with the attempt refunded) and waits for the poll to end.
 */
export const stopPollLoop = async (): Promise<void> => {
  stopped = true;
  requestShutdown();

  if (pollTimeout) clearTimeout(pollTimeout);
  if (currentPoll) await currentPoll;
};
