import type {
  BackupJob,
  BackupJobItem,
  Database,
} from '@abbottland/homelab-db';
import type {
  ConnectionDriver,
  ConnectionTarget,
} from '@abbottland/source-access';
import type { DestFs } from './dest-fs';
import { ClaimLostError } from './errors';

/**
 * Called at named points between steps. Production passes nothing; tests
 * throw from it to simulate the worker being killed at exactly that point.
 */
export type FaultHook = (
  point: string,
  detail?: string,
) => void | Promise<void>;

/** Everything the copy of one claimed item needs. */
export type CopyContext = {
  db: Database;
  job: BackupJob;
  /** The claimed item (its `claimToken` is the proof of the lease). */
  item: BackupJobItem;
  driver: ConnectionDriver;
  target: ConnectionTarget;
  dest: DestFs;
  /** No-progress timeout for source reads. */
  stallTimeoutMs: number;
  /** Aborted (with a `ClaimLostError`) when the heartbeat finds the lease gone. */
  signal: AbortSignal;
  fault: FaultHook;
};

export const claimTokenOf = (ctx: CopyContext): string =>
  ctx.item.claimToken as string;

/** Throws once the lease is lost, so no step starts on a dead claim. */
export const assertLive = (ctx: CopyContext): void => {
  if (ctx.signal.aborted) {
    throw ctx.signal.reason instanceof Error
      ? ctx.signal.reason
      : new ClaimLostError();
  }
};
