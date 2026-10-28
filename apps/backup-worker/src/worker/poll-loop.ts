import {
  getBackupDestination,
  recordBackupDestinationValidation,
  touchBackupDestinationWorker,
} from '@abbottland/homelab-db';
import { db } from '../db';
import { config, type MountCheck } from '../config';
import { getWatchdog, workerId } from '../destination/runtime';
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

/**
 * One iteration: report that the worker is alive, then validate the
 * destination at startup and whenever the API has asked for it. The worker
 * does not claim work yet (the copy engine is a later milestone).
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
    } else if (!validatedOnce || destination.validationRequestedAt) {
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
      validatedOnce = true;

      console.log(
        validation.ok
          ? '✅ destination validated'
          : `⚠️  destination validation failed: ${validation.checks
              ?.filter((c) => !c.ok)
              .map((c) => `${c.name}: ${c.message}`)
              .join('; ')}`,
      );
    }
  } catch (err) {
    console.error('❌ poll failed:', err);
  }

  scheduleNextPoll(config.pollIntervalMs);
};

export const startPollLoop = () => {
  stopped = false;
  validatedOnce = false;
  currentPoll = pollOnce().finally(() => {
    currentPoll = undefined;
  });
};

/** Stops scheduling polls and waits for one in flight to finish. */
export const stopPollLoop = async (): Promise<void> => {
  stopped = true;

  if (pollTimeout) clearTimeout(pollTimeout);
  if (currentPoll) await currentPoll;
};
