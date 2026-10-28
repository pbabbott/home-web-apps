import {
  BackupError,
  claimNextBackupItem,
  completeBackupJobIfDone,
  failBackupItem,
  getBackupDestination,
  releaseBackupItem,
  type BackupClaimIdleReason,
} from '@abbottland/homelab-db';
import {
  ConnectionError,
  getConnectionDriver,
  type ConnectionDriver,
} from '@abbottland/source-access';
import { config } from '../config';
import { db } from '../db';
import { getWatchdog, workerId } from '../destination/runtime';
import type { CopyContext, FaultHook } from './context';
import { DestFs, defaultDestFsDeps, type DestFsDeps } from './dest-fs';
import {
  ClaimLostError,
  FaultInjectedError,
  SourceUnreachableError,
} from './errors';
import { startHeartbeat } from './heartbeat';
import { processItem } from './item';
import { loadSourceTarget } from './source';
import path from 'path';

/** What tests replace; production uses the defaults. */
export type RunOptions = {
  driver?: ConnectionDriver;
  fault?: FaultHook;
  fsDeps?: DestFsDeps;
};

export type RunResult =
  | { kind: 'idle'; reason: BackupClaimIdleReason; retryAt: Date | null }
  /** The item was worked on and settled (verified, requeued, blocked or failed). */
  | { kind: 'settled'; itemId: string }
  /** The item was handed back or abandoned; the caller should wait before claiming again. */
  | { kind: 'backoff'; reason: 'claim_lost' | 'source_unreachable' | 'error' };

const systemActor = () => ({ type: 'system' as const, id: workerId });

const describe = (err: unknown): string =>
  err instanceof Error ? `${err.name}: ${err.message}` : String(err);

/**
 * Claims the next item of this worker's destination and copies it. One call
 * is one item. The lease is kept alive by a timer while it runs, and
 * `worker_seen_at` is the caller's job (it must keep ticking while this runs).
 *
 * What happens to an item that does not settle: a lost lease is left alone (the
 * job owns it again); a source that stopped answering is released with the
 * attempt refunded; any other error fails the attempt as transient, so it is
 * retried behind a backoff and eventually fails visibly.
 */
export const claimAndCopyNext = async (
  options: RunOptions = {},
): Promise<RunResult> => {
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
      intervalMs: config.backupHeartbeatSeconds * 1000,
    },
  );

  try {
    const destination = await getBackupDestination(
      db,
      config.backupDestinationId,
    );
    const { connectionType, target } = await loadSourceTarget(db, job);
    const ctx: CopyContext = {
      db,
      job,
      item,
      driver: options.driver ?? getConnectionDriver(connectionType),
      target,
      dest: new DestFs(
        config.backupDestinationPath,
        path.join(config.backupDestinationPath, destination?.rootDir ?? ''),
        options.fsDeps ??
          defaultDestFsDeps((operation, fn) =>
            getWatchdog().run(operation, fn),
          ),
      ),
      stallTimeoutMs: config.backupStallTimeoutSeconds * 1000,
      signal: heartbeat.signal,
      fault: options.fault ?? (() => undefined),
    };

    await processItem(ctx);

    return { kind: 'settled', itemId: item.id };
  } catch (err) {
    return await abandon(item.id, claimToken, err);
  } finally {
    heartbeat.stop();
  }
};

const abandon = async (
  itemId: string,
  claimToken: string,
  err: unknown,
): Promise<RunResult> => {
  // A test crash must look like a dead process: nothing is cleaned up.
  if (err instanceof FaultInjectedError) throw err;

  if (
    err instanceof ClaimLostError ||
    (err instanceof BackupError && err.code === 'conflict')
  ) {
    console.error(`⚠️  lost the claim on item ${itemId}: ${describe(err)}`);

    return { kind: 'backoff', reason: 'claim_lost' };
  }

  if (
    err instanceof SourceUnreachableError ||
    (err instanceof ConnectionError && err.code === 'unreachable')
  ) {
    console.error(
      `⚠️  source unreachable, releasing item ${itemId}: ${describe(err)}`,
    );
    await releaseBackupItem(db, itemId, { claimToken }).catch(() => undefined);

    return { kind: 'backoff', reason: 'source_unreachable' };
  }

  console.error(`❌ item ${itemId} failed:`, err);
  await failBackupItem(db, itemId, {
    claimToken,
    error: describe(err).slice(0, 1000),
    kind: 'transient',
  }).catch((failure) =>
    console.error(
      `❌ could not record the failure of item ${itemId}:`,
      failure,
    ),
  );

  return { kind: 'backoff', reason: 'error' };
};
