import type { BackupEntryIssueKind } from '@abbottland/homelab-db';
import { CopyError } from '../lib/copy-error';

/** The item's lease is gone (cancelled job, expiry): stop at once, write nothing more. */
export class ClaimLostError extends CopyError {
  constructor(message = 'the claim on this item is no longer valid') {
    super(message);
    this.name = 'ClaimLostError';
  }
}

/** The source machine does not answer. Not the item's fault, so it is released with the attempt refunded. */
export class SourceUnreachableError extends CopyError {
  constructor(message: string) {
    super(message);
    this.name = 'SourceUnreachableError';
  }
}

/**
 * The destination as a whole is broken (an I/O error, a stale or missing
 * mount, no space, no access to the root): not this item's fault, so it is
 * released with the attempt refunded and the destination is paused.
 */
export class DestinationUnhealthyError extends CopyError {
  constructor(
    readonly operation: string,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DestinationUnhealthyError';
  }
}

/** The worker was asked to stop (SIGTERM): hand the item back and leave. */
export class ShutdownError extends CopyError {
  constructor(message = 'the worker is shutting down') {
    super(message);
    this.name = 'ShutdownError';
  }
}

/** One entry cannot be copied; recorded on the entry, the rest of the item carries on. */
export class EntryFailure extends CopyError {
  constructor(
    readonly issueKind: BackupEntryIssueKind,
    message: string,
  ) {
    super(message);
    this.name = 'EntryFailure';
  }
}

/** A destination write or read failed (errno in `code`). */
export class DestWriteError extends CopyError {
  constructor(
    readonly operation: string,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DestWriteError';
  }
}

/** A file is where a directory must go, or the reverse. */
export class DestConflictError extends CopyError {
  constructor(message: string) {
    super(message);
    this.name = 'DestConflictError';
  }
}

/**
 * Thrown by a test's fault hook to emulate the process dying at that point:
 * nothing catches it, so nothing is cleaned up and nothing is recorded.
 */
export class FaultInjectedError extends CopyError {
  constructor(point: string) {
    super(`fault injected at ${point}`);
    this.name = 'FaultInjectedError';
  }
}
