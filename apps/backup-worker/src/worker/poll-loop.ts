import {
  getBackupDestination,
  recordBackupDestinationValidation,
} from '@abbottland/homelab-db';
import { db } from '../db';
import { claimAndCopyNext } from '../copy/run';
import { config, type MountCheck } from '../config';
import { DESTINATION_KEY } from '../copy/pause-tracker';
import { resumeDestinationJobs, stallDestinationJobs } from '../copy/pauses';
import {
  CLAIM_FAILURE_TEXT,
  claimDestination,
  releaseDestinationClaim,
  renewDestinationClaim,
} from '../destination/claim';
import { getWatchdog, runtimePauses, workerId } from '../destination/runtime';
import { requestShutdown, resetShutdown } from './shutdown';
import {
  defaultValidationDeps,
  validateDestination,
} from '../destination/validate';

export { workerId };

let stopped = false;
let validatedOnce = false;
/** The destination this worker holds the claim on; null until it has claimed one. */
let claimedId: string | null = null;
let lastClaimProblem: string | undefined;
let claimLost = false;
/** The configured pin, restored when a claim is dropped so the next claim is made afresh. */
let pinned = '';
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
 * Claims and copies items until there is nothing to claim or one cannot be
 * finished (then the next poll tries again). `worker_seen_at` keeps ticking
 * while an item is copied, so a long copy does not look like a dead worker.
 */
const copyWhileWorkExists = async (): Promise<void> => {
  const keepAlive = setInterval(() => {
    // A worker stuck on a hung mount must look dead, not busy.
    if (getWatchdog().state().stalled) return;
    renewDestinationClaim(config.backupDestinationId)
      .then((held) => {
        if (held || claimLost) return;

        // Another worker took the destination (this one was too slow to renew).
        claimLost = true;
        console.error(
          '❌ the destination claim was lost; releasing the item in flight',
        );
        requestShutdown();
      })
      .catch((err) =>
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

/** Forgets the claim, so the next poll claims afresh (and validates the destination again). */
const dropClaim = (): void => {
  claimedId = null;
  claimLost = false;
  validatedOnce = false;
  config.backupDestinationId = pinned;
  resetShutdown();
};

/**
 * Holds a destination: claims one if the worker has none, otherwise renews
 * the claim (which also reports that the worker is alive). False means there
 * is nothing to serve this poll; the reason is logged when it changes.
 */
const ensureClaim = async (): Promise<boolean> => {
  if (claimedId) {
    if (await renewDestinationClaim(claimedId)) return true;

    console.error('❌ the destination claim was lost');
    dropClaim();
  }

  const result = await claimDestination();

  if (!('destination' in result)) {
    const problem = CLAIM_FAILURE_TEXT[result.reason];

    if (problem !== lastClaimProblem) {
      console.error(`⚠️  not serving a destination: ${problem}`);
      lastClaimProblem = problem;
    }

    return false;
  }

  lastClaimProblem = undefined;
  claimedId = result.destination.id;
  validatedOnce = false;
  console.log(
    `✅ serving destination ${result.destination.name} (${result.destination.id})`,
  );

  return true;
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
    if (!(await ensureClaim())) {
      scheduleNextPoll(config.pollIntervalMs);
      return;
    }

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
      validatedOnce = true;

      if (validation.ok) await resumeDestinationJobs();
      else await stallDestinationJobs(runtimePauses);

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

    if (claimLost) dropClaim();
  } catch (err) {
    console.error('❌ poll failed:', err);
  }

  scheduleNextPoll(config.pollIntervalMs);
};

export const startPollLoop = () => {
  stopped = false;
  pinned = config.backupDestinationId;
  claimedId = null;
  claimLost = false;
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
  if (claimedId) {
    await releaseDestinationClaim(claimedId).catch((err) =>
      console.error('❌ could not release the destination claim:', err),
    );
    claimedId = null;
  }
};
