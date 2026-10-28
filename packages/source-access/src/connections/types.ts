import type { Readable } from 'node:stream';
import type { SourceConnectionSettings } from '@abbottland/homelab-db';

/** Everything a driver needs to reach one source, with the secret decrypted. */
export type ConnectionTarget = {
  /** Address of the machine (the linked host's IP). */
  address: string;
  /** Other names the machine answers to; used to accept UNC paths naming it. */
  hostNames: string[];
  username: string;
  domain: string | null;
  password: string;
  settings: SourceConnectionSettings;
};

export type TestResult = { ok: true } | { ok: false; error: string };

/** A failure the reviewer can act on (bad password, no share, file gone). */
export class ConnectionError extends Error {
  constructor(
    readonly code:
      | 'auth'
      | 'not_found'
      | 'no_share'
      | 'unreachable'
      | 'unsupported_path'
      | 'failed',
    message: string,
  ) {
    super(message);
    this.name = 'ConnectionError';
  }
}

/** One entry of a directory listing. */
export type DirEntry = {
  name: string;
  isDirectory: boolean;
  size: number;
  /** ISO timestamp; the source reports local time without a zone. */
  modifiedAt: string | null;
};

/**
 * Reads files from a source over one protocol. Paths are Windows paths as
 * stored in inventory (`C:\Users\you\a.jpg`). Add a driver per
 * `source_connection_type` value.
 */
export interface ConnectionDriver {
  test(target: ConnectionTarget): Promise<TestResult>;
  /** Size in bytes of a file. Throws ConnectionError. */
  stat(target: ConnectionTarget, path: string): Promise<{ size: number }>;
  /**
   * Streams a file. Destroying the stream stops the transfer. Call `stat`
   * first: errors that happen after the stream starts can only surface as
   * a truncated stream.
   */
  open(target: ConnectionTarget, path: string): Readable;
  /**
   * The last `bytes` of a file of `size` bytes, without transferring the
   * rest. Throws ConnectionError.
   */
  readTail(
    target: ConnectionTarget,
    path: string,
    size: number,
    bytes: number,
  ): Promise<Buffer>;
  /** The direct children of a directory (no `.`/`..`). Throws ConnectionError. */
  list(target: ConnectionTarget, path: string): Promise<DirEntry[]>;
}
