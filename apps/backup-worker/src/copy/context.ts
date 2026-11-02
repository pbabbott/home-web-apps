import type {
  BackupJob,
  ClaimedBackupJobItem,
  Database,
} from '@abbottland/homelab-db';
import type {
  ConnectionDriver,
  ConnectionTarget,
} from '@abbottland/source-access';
import type { DestFs } from './dest-fs';
import { ClaimLostError } from './errors';

/** Every point the copy reports to a `FaultHook`, in the order they happen. */
export type FaultPoint =
  | 'item:start'
  | 'item:after-enumeration-batch'
  | 'item:after-enumeration-complete'
  | 'item:after-allinfo'
  | 'item:after-directory-time'
  | 'item:before-finish'
  | 'stage:chunk'
  | 'entry:start'
  | 'entry:after-metadata'
  | 'entry:after-stage'
  | 'entry:after-link'
  | 'entry:after-unlink'
  | 'entry:after-utimes'
  | 'entry:after-verify'
  | 'entry:before-record'
  | 'entry:after-record';

/**
 * Called at named points between steps. Production passes nothing; tests
 * throw from it to simulate the worker being killed at exactly that point.
 */
export type FaultHook = (
  point: FaultPoint,
  detail?: string,
) => void | Promise<void>;

/** Everything the copy of one claimed item needs. */
export type CopyContext = {
  db: Database;
  job: BackupJob;
  /** The claimed item (its `claimToken` is the proof of the lease). */
  item: ClaimedBackupJobItem;
  driver: ConnectionDriver;
  target: ConnectionTarget;
  dest: DestFs;
  /** No-progress timeout for source reads. */
  stallTimeoutMs: number;
  /** Aborted (with a `ClaimLostError`) when the heartbeat finds the lease gone. */
  signal: AbortSignal;
  fault: FaultHook;
  /** Files of one item copied at once (`BACKUP_PARALLELISM`). */
  parallelism: number;
  /** Run before the item starts: throws `DestinationUnhealthyError` when the mount is gone. */
  preflight: () => Promise<void>;
};

export const claimTokenOf = (ctx: CopyContext): string => ctx.item.claimToken;

/** Throws once the lease is lost, so no step starts on a dead claim. */
export const assertLive = (ctx: CopyContext): void => {
  if (ctx.signal.aborted) {
    throw ctx.signal.reason instanceof Error
      ? ctx.signal.reason
      : new ClaimLostError();
  }
};
