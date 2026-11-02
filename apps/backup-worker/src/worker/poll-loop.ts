import path from 'path';
import {
  getBackupDestination,
  recordBackupDestinationValidation,
} from '@abbottland/homelab-db';
import { db } from '../db';
import { claimAndCopyNext } from '../copy/run';
import { config, type MountCheck } from '../config';
import { describeDestinationRecord } from '../destination/describe';
import { DESTINATION_KEY } from '../copy/pause-tracker';
import {
  pauseDestination,
  resumeDestinationJobs,
  stallDestinationJobs,
} from '../copy/pauses';
import {
  CLAIM_FAILURE_TEXT,
  claimDestination,
  releaseDestinationClaim,
  renewDestinationClaim,
} from '../destination/claim';
import type { WorkerRuntime } from '../destination/runtime';
import { workerId } from '../worker-id';
import { requestShutdown, resetShutdown } from './shutdown';
import {
  defaultValidationDeps,
  validateDestination,
} from '../destination/validate';

/**
 * Claims a destination, validates it, and copies what is claimable, poll after
 * poll. All of its state is here: a fresh instance starts from nothing.
 */
export class PollLoop {
  private stopped = false;
  private validatedOnce = false;
  /** The destination this loop holds the claim on; null until it has claimed one. */
  private claimedId: string | null = null;
  private lastClaimProblem: string | undefined;
  private claimLost = false;
  private pollTimeout: NodeJS.Timeout | undefined;
  private currentPoll: Promise<void> | undefined;
  private removeStallListener: (() => void) | undefined;

  constructor(private readonly runtime: WorkerRuntime) {}

  start(): void {
    this.stopped = false;
    this.claimedId = null;
    this.claimLost = false;
    this.validatedOnce = false;
    resetShutdown();
    // A stalled destination call marks the destination unhealthy and pauses its jobs.
    this.removeStallListener = this.runtime.watchdog.onStall((operation) => {
      console.error(`❌ destination call stalled: ${operation}`);

      if (!this.claimedId) return;
      void pauseDestination(
        this.runtime.pauses,
        this.claimedId,
        `watchdog: ${operation} made no progress for ${Math.round(config.backupStallTimeoutSeconds)}s`,
      ).catch((err) =>
        console.error('❌ could not pause the destination:', err),
      );
    });
    this.currentPoll = this.pollOnce().finally(() => {
      this.currentPoll = undefined;
    });
  }

  /**
   * Stops scheduling polls, aborts the transfer in flight (its item is
   * released with the attempt refunded) and waits for the poll to end.
   */
  async stop(): Promise<void> {
    this.stopped = true;
    requestShutdown();

    if (this.pollTimeout) clearTimeout(this.pollTimeout);
    if (this.currentPoll) await this.currentPoll;
    this.removeStallListener?.();
    if (this.claimedId) {
      await releaseDestinationClaim(this.claimedId).catch((err) =>
        console.error('❌ could not release the destination claim:', err),
      );
      this.claimedId = null;
    }
  }

  /**
   * One iteration: report that the worker is alive, validate the destination
   * at startup and whenever the API has asked for it, then copy whatever is
   * claimable. A validation request made during a long copy waits for the
   * item to end.
   */
  async pollOnce(): Promise<void> {
    if (this.stopped) return;

    try {
      const destinationId = await this.ensureClaim();

      if (!destinationId) {
        this.scheduleNextPoll(config.pollIntervalMs);
        return;
      }

      const destination = await getBackupDestination(db, destinationId);

      if (!destination) {
        console.error(`❌ backup destination ${destinationId} does not exist`);
      } else if (
        !this.validatedOnce ||
        destination.validationRequestedAt ||
        // An unhealthy destination is checked again by itself, with a backoff.
        (destination.health === 'unhealthy' &&
          this.runtime.pauses.due(DESTINATION_KEY))
      ) {
        console.log(
          `🗄️  backup destination record (database, not environment) for ${destination.name}`,
        );
        describeDestinationRecord(destination).forEach((line) =>
          console.log(`  ${line}`),
        );

        const validation = await validateDestination(
          {
            destination,
            mountPath: config.backupDestinationPath,
            mountCheck: config.backupDestinationMountCheck as MountCheck,
          },
          defaultValidationDeps((operation, fn) =>
            this.runtime.watchdog.run(operation, fn),
          ),
        );

        await recordBackupDestinationValidation(db, destination.id, {
          workerId,
          validation,
        });
        this.validatedOnce = true;

        if (validation.ok) await resumeDestinationJobs(destinationId);
        else await stallDestinationJobs(this.runtime.pauses, destinationId);

        // Where files really go: the worker's mount (not the export recorded
        // on the destination, which is only the identity it is checked against).
        const writeRoot = path.join(
          config.backupDestinationPath,
          destination.rootDir ?? '',
        );
        const expected = `${destination.host.ipAddress}:${destination.settings.exportPath}`;

        console.log(
          validation.ok
            ? `✅ destination validated: writing to ${writeRoot} (expects export ${expected}, mount check ${config.backupDestinationMountCheck})`
            : `⚠️  destination validation failed: ${validation.checks
                ?.filter((c) => !c.ok)
                .map((c) => `${c.name}: ${c.message}`)
                .join('; ')}`,
        );
      }

      if (destination) await this.copyWhileWorkExists(destinationId);

      if (this.claimLost) this.dropClaim();
    } catch (err) {
      console.error('❌ poll failed:', err);
    }

    this.scheduleNextPoll(config.pollIntervalMs);
  }

  private scheduleNextPoll(delayMs: number): void {
    if (this.stopped) return;
    this.pollTimeout = setTimeout(() => {
      this.currentPoll = this.pollOnce().finally(() => {
        this.currentPoll = undefined;
      });
    }, delayMs);
  }

  /**
   * Claims and copies items until there is nothing to claim or one cannot be
   * finished (then the next poll tries again). `worker_seen_at` keeps ticking
   * while an item is copied, so a long copy does not look like a dead worker.
   */
  private async copyWhileWorkExists(destinationId: string): Promise<void> {
    const keepAlive = setInterval(() => {
      // A worker stuck on a hung mount must look dead, not busy.
      if (this.runtime.watchdog.state().stalled) return;
      renewDestinationClaim(destinationId)
        .then((held) => {
          if (held || this.claimLost) return;

          // Another worker took the destination (this one was too slow to renew).
          this.claimLost = true;
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
      while (!this.stopped) {
        const result = await claimAndCopyNext({
          ...this.runtime,
          destinationId,
        });

        if (result.kind !== 'settled') return;
      }
    } finally {
      clearInterval(keepAlive);
    }
  }

  /** Forgets the claim, so the next poll claims afresh (and validates the destination again). */
  private dropClaim(): void {
    this.claimedId = null;
    this.claimLost = false;
    this.validatedOnce = false;
    resetShutdown();
  }

  /**
   * Holds a destination: claims one if the worker has none, otherwise renews
   * the claim (which also reports that the worker is alive). Returns its id,
   * or null when there is nothing to serve this poll; the reason is logged
   * when it changes.
   */
  private async ensureClaim(): Promise<string | null> {
    if (this.claimedId) {
      if (await renewDestinationClaim(this.claimedId)) return this.claimedId;

      console.error('❌ the destination claim was lost');
      this.dropClaim();
    }

    const result = await claimDestination(config.backupDestinationId);

    if (!('destination' in result)) {
      const problem = CLAIM_FAILURE_TEXT[result.reason];

      if (problem !== this.lastClaimProblem) {
        console.error(`⚠️  not serving a destination: ${problem}`);
        this.lastClaimProblem = problem;
      }

      return null;
    }

    this.lastClaimProblem = undefined;
    this.claimedId = result.destination.id;
    this.validatedOnce = false;
    console.log(
      `✅ serving destination ${result.destination.name} (${result.destination.id})`,
    );

    return this.claimedId;
  }
}
