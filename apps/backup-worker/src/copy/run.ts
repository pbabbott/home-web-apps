import {
  BackupError,
  claimNextBackupItem,
  completeBackupJobIfDone,
  failBackupItem,
  getBackupDestination,
  releaseBackupItem,
  type BackupClaimIdleReason,
  type BackupJob,
  type BackupJobItem,
} from '@abbottland/homelab-db';
import {
  ConnectionError,
  getConnectionDriver,
  type ConnectionDriver,
} from '@abbottland/source-access';
import { config } from '../config';
import { db } from '../db';
import {
  getWatchdog,
  makeDestFs,
  onDestinationStall,
  runtimePauses,
  workerId,
} from '../destination/runtime';
import type { CopyContext, FaultHook } from './context';
import type { DestFsDeps } from './dest-fs';
import {
  ClaimLostError,
  DestinationUnhealthyError,
  FaultInjectedError,
  ShutdownError,
  SourceUnreachableError,
} from './errors';
import { stagingDir } from './layout';
import { DESTINATION_KEY, sourceKey, type PauseTracker } from './pause-tracker';
import {
  pauseDestination,
  pauseSource,
  resumeReachableSources,
} from './pauses';
import { assertMounted } from './preflight';
import { startHeartbeat } from './heartbeat';
import { processItem } from './item';
import { loadSourceTarget } from './source';
import { shutdownSignal } from '../worker/shutdown';

/** What tests replace; production uses the defaults. */
export type RunOptions = {
  driver?: ConnectionDriver;
  fault?: FaultHook;
  fsDeps?: DestFsDeps;
  /** Backoff state for paused jobs; tests pass one with a fake clock. */
  pauses?: PauseTracker;
  /** Replaces the worker-wide shutdown signal. */
  shutdownSignal?: AbortSignal;
  /** Files of one item copied at once; defaults to `BACKUP_PARALLELISM`. */
  parallelism?: number;
  /** Heartbeat interval in ms; defaults to `BACKUP_HEARTBEAT_SECONDS`. */
  heartbeatMs?: number;
  /** Replaces the mount check that runs before each item. */
  preflight?: () => Promise<void>;
};

export type RunResult =
  | { kind: 'idle'; reason: BackupClaimIdleReason; retryAt: Date | null }
  /** The item was worked on and settled (verified, requeued, blocked or failed). */
  | { kind: 'settled'; itemId: string }
  /** The item was handed back or abandoned; the caller should wait before claiming again. */
  | {
      kind: 'backoff';
      reason:
        | 'claim_lost'
        | 'source_unreachable'
        | 'destination_unhealthy'
        | 'shutdown'
        | 'error';
    };

const systemActor = () => ({ type: 'system' as const, id: workerId });

const describe = (err: unknown): string =>
  err instanceof Error ? `${err.name}: ${err.message}` : String(err);

/**
 * Claims the next item of this worker's destination and copies it. One call
 * is one item. The lease is kept alive by a timer while it runs, and
 * `worker_seen_at` is the caller's job (it must keep ticking while this runs).
 *
 * What happens to an item that does not settle: a lost lease is left alone (the
 * job owns it again); a source that stopped answering or a broken destination
 * releases the item with the attempt refunded and pauses the job (no attempts
 * are spent while paused); any other error fails the attempt as transient, so
 * it is retried behind a backoff and eventually fails visibly.
 */
export const claimAndCopyNext = async (
  options: RunOptions = {},
): Promise<RunResult> => {
  const pauses = options.pauses ?? runtimePauses;

  await resumeReachableSources(pauses, options.driver);

  const claim = await claimNextBackupItem(db, {
    destinationId: config.backupDestinationId,
    workerId,
    leaseSeconds: config.backupLeaseSeconds,
  });

  if (!('job' in claim)) {
    for (const jobId of claim.drainedJobIds) {
      await completeBackupJobIfDone(db, jobId, systemActor());
    }

    return { kind: 'idle', reason: claim.reason, retryAt: claim.retryAt };
  }

  const { item, job } = claim;
  const claimToken = item.claimToken as string;
  const heartbeat = startHeartbeat(
    db,
    { id: item.id, claimToken },
    {
      leaseSeconds: config.backupLeaseSeconds,
      intervalMs: options.heartbeatMs ?? config.backupHeartbeatSeconds * 1000,
      shouldBeat: () => !getWatchdog().state().stalled,
    },
  );
  // A stalled destination call cannot be cancelled, but the rest of the item
  // (the source transfer, the next steps) stops as soon as it returns.
  const stalled = new AbortController();
  const stopListening = onDestinationStall((operation) =>
    stalled.abort(
      new DestinationUnhealthyError(
        operation,
        'STALLED',
        `${operation} made no progress for ${Math.round(config.backupStallTimeoutSeconds)}s`,
      ),
    ),
  );

  let ctx: CopyContext | undefined;

  try {
    const destination = await getBackupDestination(
      db,
      config.backupDestinationId,
    );
    const { connectionType, target } = await loadSourceTarget(db, job);
    ctx = {
      db,
      job,
      item,
      driver: options.driver ?? getConnectionDriver(connectionType),
      target,
      dest: makeDestFs(destination?.rootDir, options.fsDeps),
      stallTimeoutMs: config.backupStallTimeoutSeconds * 1000,
      signal: AbortSignal.any([
        heartbeat.signal,
        stalled.signal,
        options.shutdownSignal ?? shutdownSignal(),
      ]),
      fault: options.fault ?? (() => undefined),
      parallelism: options.parallelism ?? config.backupParallelism,
      preflight:
        options.preflight ??
        (() =>
          assertMounted({
            mountCheck: config.backupDestinationMountCheck,
            mountPath: config.backupDestinationPath,
            expected: destination?.settings as {
              server: string;
              exportPath: string;
            },
            run: (operation, fn) => getWatchdog().run(operation, fn),
          })),
    };

    await processItem(ctx);
    pauses.reset(DESTINATION_KEY);
    pauses.reset(sourceKey(job.id));

    return { kind: 'settled', itemId: item.id };
  } catch (err) {
    return await abandon({ ctx, item, job, claimToken, err, pauses });
  } finally {
    heartbeat.stop();
    stopListening();
  }
};

type Abandoned = {
  ctx?: CopyContext;
  item: BackupJobItem;
  job: BackupJob;
  claimToken: string;
  err: unknown;
  pauses: PauseTracker;
};

const release = (itemId: string, claimToken: string) =>
  releaseBackupItem(db, itemId, { claimToken }).catch(() => undefined);

const failTransient = (itemId: string, claimToken: string, error: string) =>
  failBackupItem(db, itemId, {
    claimToken,
    error: error.slice(0, 1000),
    kind: 'transient',
  }).catch((failure) =>
    console.error(
      `❌ could not record the failure of item ${itemId}:`,
      failure,
    ),
  );

/** Deletes the item's staging folder; the destination may be hung, so a failure is only logged. */
const removeStaging = async (
  ctx: CopyContext | undefined,
  itemId: string,
): Promise<void> => {
  if (!ctx) return;

  try {
    await ctx.dest.removeItemStaging(stagingDir(ctx.dest.baseRoot, itemId));
    await ctx.dest.removeStagingRootIfEmpty();
  } catch (err) {
    console.error(`⚠️  could not remove the staging of item ${itemId}:`, err);
  }
};

const abandon = async ({
  ctx,
  item,
  job,
  claimToken,
  err,
  pauses,
}: Abandoned): Promise<RunResult> => {
  // A test crash must look like a dead process: nothing is cleaned up.
  if (err instanceof FaultInjectedError) throw err;

  if (err instanceof ShutdownError) {
    console.log(`🛑 shutting down, releasing item ${item.id}`);
    await removeStaging(ctx, item.id);
    await release(item.id, claimToken);

    return { kind: 'backoff', reason: 'shutdown' };
  }

  if (
    err instanceof ClaimLostError ||
    (err instanceof BackupError && err.code === 'conflict')
  ) {
    console.error(`⚠️  lost the claim on item ${item.id}: ${describe(err)}`);
    // The item is not ours any more (a cancelled job's items are never
    // claimed again), so nothing would clean up after it.
    await removeStaging(ctx, item.id);

    return { kind: 'backoff', reason: 'claim_lost' };
  }

  if (err instanceof DestinationUnhealthyError) {
    console.error(
      `⚠️  destination unhealthy, releasing item ${item.id}: ${describe(err)}`,
    );
    await release(item.id, claimToken);
    await pauseDestination(
      pauses,
      `${err.operation} failed with ${err.code}: ${err.message}`,
    ).catch((failure) =>
      console.error('❌ could not pause the destination:', failure),
    );

    return { kind: 'backoff', reason: 'destination_unhealthy' };
  }

  if (
    err instanceof SourceUnreachableError ||
    (err instanceof ConnectionError && err.code === 'unreachable')
  ) {
    // The source is only called unreachable if it also fails a plain
    // connection test; otherwise the failure counts as an attempt, so a
    // misleading error cannot keep an item cycling for free.
    const answers = ctx
      ? await ctx.driver.test(ctx.target).then(
          (probe) => probe.ok,
          () => false,
        )
      : false;

    if (!answers) {
      console.error(
        `⚠️  source unreachable, pausing job ${job.id} and releasing item ${item.id}: ${describe(err)}`,
      );
      await release(item.id, claimToken);
      await pauseSource(pauses, job).catch((failure) =>
        console.error('❌ could not pause the job:', failure),
      );

      return { kind: 'backoff', reason: 'source_unreachable' };
    }

    console.error(
      `❌ item ${item.id} failed (the source reported an outage but answers a connection test): ${describe(err)}`,
    );
    await failTransient(
      item.id,
      claimToken,
      `${describe(err)} (the source answers a connection test, so this attempt counts)`,
    );

    return { kind: 'backoff', reason: 'error' };
  }

  console.error(`❌ item ${item.id} failed:`, err);
  await failTransient(item.id, claimToken, describe(err));

  return { kind: 'backoff', reason: 'error' };
};
