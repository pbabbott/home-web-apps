import { BackupError } from '@abbottland/homelab-db';
import { ConnectionError } from '@abbottland/source-access';
import {
  ClaimLostError,
  DestinationUnhealthyError,
  FaultInjectedError,
  ShutdownError,
  SourceUnreachableError,
} from './errors';

/**
 * What happens to an item that did not settle. This table is the policy; the
 * executor in `run.ts` only carries it out. A new error type is a new row here
 * (and in the table in `docs/exodus/backup.md`).
 */
export type AbandonPolicy =
  /** A crash injected by a test: nothing is cleaned up or recorded. */
  | { action: 'rethrow' }
  | {
      /**
       * `release`: hand the item back with the attempt refunded.
       * `leave`: the item is not ours any more, so write nothing to it.
       * `fail`: record a transient failure; the attempt counts and the item is
       * retried behind a backoff until its attempts run out.
       */
      action: 'release' | 'leave' | 'fail';
      /** Delete the item's staging folder (nothing else would clean up after it). */
      removeStaging: boolean;
      /** Pause the destination's or the job's other work until it answers again. */
      pause?: 'source' | 'destination';
      /** Added to the recorded error when the attempt counts despite an outage report. */
      note?: string;
      reason:
        | 'claim_lost'
        | 'source_unreachable'
        | 'destination_unhealthy'
        | 'shutdown'
        | 'error';
    };

/** A source outage is only believed if the source also fails a plain connection test. */
export const isSourceOutage = (err: unknown): boolean =>
  err instanceof SourceUnreachableError ||
  (err instanceof ConnectionError && err.code === 'unreachable');

/**
 * @param sourceAnswers whether the source passes a connection test; only
 *   consulted for a source outage (see `isSourceOutage`). A misleading outage
 *   report on a source that answers counts as an attempt, so it cannot keep an
 *   item cycling for free.
 */
export const classifyAbandon = (
  err: unknown,
  { sourceAnswers }: { sourceAnswers: boolean },
): AbandonPolicy => {
  if (err instanceof FaultInjectedError) return { action: 'rethrow' };

  if (err instanceof ShutdownError) {
    return { action: 'release', removeStaging: true, reason: 'shutdown' };
  }

  if (
    err instanceof ClaimLostError ||
    (err instanceof BackupError && err.code === 'conflict')
  ) {
    return { action: 'leave', removeStaging: true, reason: 'claim_lost' };
  }

  if (err instanceof DestinationUnhealthyError) {
    return {
      action: 'release',
      removeStaging: false,
      pause: 'destination',
      reason: 'destination_unhealthy',
    };
  }

  if (isSourceOutage(err)) {
    return sourceAnswers
      ? {
          action: 'fail',
          removeStaging: false,
          note: 'the source answers a connection test, so this attempt counts',
          reason: 'error',
        }
      : {
          action: 'release',
          removeStaging: false,
          pause: 'source',
          reason: 'source_unreachable',
        };
  }

  return { action: 'fail', removeStaging: false, reason: 'error' };
};
