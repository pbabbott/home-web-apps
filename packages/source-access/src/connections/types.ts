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
      | 'stalled'
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

/** One item of a recursive listing. Paths are relative to the listed root, `\\`-separated. */
export type TreeEntry =
  | {
      kind: 'entry';
      relPath: string;
      name: string;
      isDirectory: boolean;
      size: number;
      /** Write time in UTC, to the second. */
      modifiedAt: Date | null;
      /** Attribute letters from the listing (`A`, `D`, `H`, `S`, `R`, `N`, `I`). */
      attributes: string;
    }
  | {
      /** A directory the listing could not enter. */
      kind: 'error';
      relPath: string;
      code: ConnectionError['code'];
      message: string;
    };

/** What `allinfo` reports about one path. Times are absolute instants. */
export type FileInfo = {
  isDirectory: boolean;
  /** Size of the default data stream; 0 for a directory. */
  size: number;
  createdAt: Date;
  accessedAt: Date;
  modifiedAt: Date;
  changedAt: Date;
  /** Attribute letters, for example `A` or `RHS`. */
  attributes: string;
  /** The raw attribute bits (the number `allinfo` prints in hex). */
  attributeBits: number;
  /** Alternate data streams (never the default one). */
  streams: { name: string; size: number }[];
  /** The reparse-point bit: a junction or symbolic link. */
  isReparsePoint: boolean;
};

export type OpenStreamOptions = {
  /** Fails with `ConnectionError('stalled')` when no bytes arrive for this long. */
  stallTimeoutMs: number;
  /** Aborting kills the transfer; the stream is destroyed with the abort reason. */
  signal?: AbortSignal;
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
  /**
   * Every descendant of a directory, depth first, in one session (times in
   * UTC). Streamed: the listing is never held in memory. Stop iterating to
   * stop the transfer. Subdirectories that cannot be listed come as
   * `kind: 'error'`. Throws ConnectionError if the root itself cannot be listed.
   */
  listTree(target: ConnectionTarget, path: string): AsyncIterable<TreeEntry>;
  /**
   * Metadata of many paths, one session per share and batch. The result has
   * one item per input path, in order: the info, or the ConnectionError for
   * that path (for example `not_found`). Never throws for a single path.
   */
  allinfo(
    target: ConnectionTarget,
    paths: string[],
  ): Promise<(FileInfo | ConnectionError)[]>;
  /**
   * Streams a file. A stream that ends early gives no error, so compare the
   * byte count with the size. Errors that happen after it starts are emitted
   * on the stream (`ConnectionError`, including `stalled`).
   */
  openStream(
    target: ConnectionTarget,
    path: string,
    options: OpenStreamOptions,
  ): Readable;
  /**
   * The text of a small alternate stream (`Zone.Identifier`), cut at
   * `maxBytes`; null if the file has no such stream.
   */
  readNamedStream(
    target: ConnectionTarget,
    path: string,
    streamName: string,
    maxBytes: number,
  ): Promise<string | null>;
}
