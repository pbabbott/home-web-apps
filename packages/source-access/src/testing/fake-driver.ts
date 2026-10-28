import { Readable } from 'node:stream';
import {
  ConnectionError,
  type ConnectionDriver,
  type ConnectionTarget,
  type DirEntry,
  type FileInfo,
  type OpenStreamOptions,
  type TestResult,
  type TreeEntry,
} from '../connections/types';
import { normalizeWindowsPath, windowsPathParent } from '../windows-path';

type Times = {
  createdAt?: Date;
  modifiedAt?: Date;
  accessedAt?: Date;
  changedAt?: Date;
};

type Node = {
  /** Canonical path as written. */
  path: string;
  isDirectory: boolean;
  content: Buffer;
  times: Required<Times>;
  attributes: string;
  streams: { name: string; content: Buffer }[];
  /** A junction or link: never listed into; `allinfo` shows the reparse bit. */
  reparse: boolean;
  unlistable: boolean;
  /** False: `ls` does not show it (the spike found this for real junctions). */
  listed: boolean;
};

/** What goes wrong when a file is read. Applies to the next `times` reads (default: all). */
export type FakeFault =
  | { kind: 'short'; bytes: number; times?: number }
  | { kind: 'error'; afterBytes: number; times?: number }
  | { kind: 'stall'; afterBytes: number; times?: number }
  | { kind: 'unreachable'; times?: number };

const DEFAULT_TIME = new Date('2020-01-02T03:04:05Z');
const CHUNK = 64 * 1024;

const key = (path: string) => normalizeWindowsPath(path).normalizedPath;

/**
 * An in-memory source for tests of anything that copies from a source: files
 * with content, times, attributes and streams; directories, junctions and
 * unlistable directories; faults on read; and a call log. Like the real
 * source, reading a file moves its access time (so a test can prove that
 * metadata was captured before the file was read). Times are whole seconds.
 */
export class FakeDriver implements ConnectionDriver {
  readonly calls: string[] = [];
  /** When true every call fails as an unreachable machine would. */
  unreachable = false;
  private readonly nodes = new Map<string, Node>();
  private readonly faults = new Map<string, FakeFault[]>();
  /** Called before each chunk of a read is emitted; throw to abort. */
  onChunk?: (path: string, offset: number) => void;

  addDirectory(
    path: string,
    options: Times & { attributes?: string; unlistable?: boolean } = {},
  ): this {
    this.put(path, true, Buffer.alloc(0), options);
    this.ensureParents(path);

    return this;
  }

  addFile(
    path: string,
    content: Buffer | string,
    options: Times & {
      attributes?: string;
      streams?: { name: string; content: Buffer | string }[];
    } = {},
  ): this {
    const node = this.put(
      path,
      false,
      Buffer.isBuffer(content) ? content : Buffer.from(content),
      options,
    );
    node.streams = (options.streams ?? []).map((s) => ({
      name: s.name,
      content: Buffer.isBuffer(s.content) ? s.content : Buffer.from(s.content),
    }));
    this.ensureParents(path);

    return this;
  }

  /**
   * A junction: a directory with the reparse bit that cannot be listed. Real
   * listings usually omit junctions (`listed: false`); one that is listed
   * fails with not-found when entered.
   */
  addJunction(path: string, options: { listed?: boolean } = {}): this {
    const node = this.put(path, true, Buffer.alloc(0), {
      attributes: 'DHS',
    });
    node.reparse = true;
    node.unlistable = true;
    node.listed = options.listed ?? true;
    this.ensureParents(path);

    return this;
  }

  remove(path: string): this {
    const prefix = `${key(path)}\\`;

    for (const k of [...this.nodes.keys()]) {
      if (k === key(path) || k.startsWith(prefix)) this.nodes.delete(k);
    }

    return this;
  }

  fault(path: string, fault: FakeFault): this {
    const list = this.faults.get(key(path)) ?? [];

    list.push(fault);
    this.faults.set(key(path), list);

    return this;
  }

  clearFaults(): this {
    this.faults.clear();

    return this;
  }

  /** The node's current times, to compare with what was captured. */
  timesOf(path: string): Required<Times> {
    return this.require(path).times;
  }

  callsOf(kind: string): string[] {
    return this.calls.filter((c) => c.startsWith(`${kind} `));
  }

  // --- ConnectionDriver ---------------------------------------------------

  async test(): Promise<TestResult> {
    this.calls.push('test');

    return this.unreachable
      ? { ok: false, error: 'Could not reach the machine over SMB' }
      : { ok: true };
  }

  async stat(_target: ConnectionTarget, path: string) {
    this.calls.push(`stat ${path}`);
    this.assertReachable();
    const node = this.require(path);

    return { size: node.content.length };
  }

  open(_target: ConnectionTarget, path: string): Readable {
    return this.openStream(_target, path, { stallTimeoutMs: 1000 });
  }

  async readTail(
    _target: ConnectionTarget,
    path: string,
    size: number,
    bytes: number,
  ) {
    this.calls.push(`readTail ${path}`);
    this.assertReachable();
    const node = this.require(path);

    return node.content.subarray(Math.max(0, size - bytes));
  }

  async list(_target: ConnectionTarget, path: string): Promise<DirEntry[]> {
    this.calls.push(`list ${path}`);
    this.assertReachable();
    this.requireListable(path);

    return this.childrenOf(path).map((child) => ({
      name: child.path.slice(child.path.lastIndexOf('\\') + 1),
      isDirectory: child.isDirectory,
      size: child.content.length,
      modifiedAt: child.times.modifiedAt.toISOString().slice(0, 19),
    }));
  }

  async *listTree(
    _target: ConnectionTarget,
    path: string,
  ): AsyncGenerator<TreeEntry> {
    this.calls.push(`listTree ${path}`);
    this.assertReachable();
    this.requireListable(path);

    yield* this.walk(this.require(path).path, this.require(path).path.length);
  }

  private *walk(dir: string, rootLength: number): Generator<TreeEntry> {
    const children = this.childrenOf(dir).filter((child) => child.listed);

    for (const child of children) {
      yield {
        kind: 'entry',
        relPath: child.path.slice(rootLength + 1),
        name: child.path.slice(child.path.lastIndexOf('\\') + 1),
        isDirectory: child.isDirectory,
        size: child.content.length,
        modifiedAt: child.times.modifiedAt,
        attributes: child.attributes,
      };
    }
    for (const child of children) {
      if (!child.isDirectory) continue;
      if (child.unlistable) {
        yield {
          kind: 'error',
          relPath: child.path.slice(rootLength + 1),
          code: child.reparse ? 'not_found' : 'auth',
          message: child.reparse
            ? 'NT_STATUS_OBJECT_NAME_NOT_FOUND'
            : 'NT_STATUS_ACCESS_DENIED',
        };
        continue;
      }
      yield* this.walk(child.path, rootLength);
    }
  }

  async allinfo(
    _target: ConnectionTarget,
    paths: string[],
  ): Promise<(FileInfo | ConnectionError)[]> {
    return paths.map((path) => {
      this.calls.push(`allinfo ${path}`);
      if (this.unreachable) {
        return new ConnectionError('unreachable', 'machine is off');
      }
      const node = this.nodes.get(key(path));

      if (!node) {
        return new ConnectionError('not_found', 'File not found on the source');
      }

      return {
        isDirectory: node.isDirectory,
        size: node.content.length,
        createdAt: node.times.createdAt,
        accessedAt: node.times.accessedAt,
        modifiedAt: node.times.modifiedAt,
        changedAt: node.times.changedAt,
        attributes: node.attributes,
        attributeBits: node.reparse ? 0x410 : node.isDirectory ? 0x10 : 0x20,
        streams: node.streams.map((s) => ({
          name: s.name,
          size: s.content.length,
        })),
        isReparsePoint: node.reparse,
      } satisfies FileInfo;
    });
  }

  openStream(
    _target: ConnectionTarget,
    path: string,
    options: OpenStreamOptions,
  ): Readable {
    this.calls.push(`open ${path}`);

    return Readable.from(this.read(path, options), { objectMode: false });
  }

  private async *read(
    path: string,
    options: OpenStreamOptions,
  ): AsyncGenerator<Buffer> {
    this.assertReachable();
    const fault = this.nextFault(path);

    if (fault?.kind === 'unreachable') {
      throw new ConnectionError('unreachable', 'machine is off');
    }
    const node = this.require(path);
    if (node.isDirectory) {
      throw new ConnectionError('failed', 'is a directory');
    }
    // Like the real source, reading moves the access time.
    node.times.accessedAt = new Date(Math.floor(Date.now() / 1000) * 1000);

    const failsAfter =
      fault?.kind === 'error' || fault?.kind === 'stall'
        ? fault.afterBytes
        : undefined;
    const limit = Math.min(
      node.content.length,
      fault?.kind === 'short' ? fault.bytes : node.content.length,
      failsAfter ?? node.content.length,
    );

    for (let offset = 0; offset < limit; offset += CHUNK) {
      if (options.signal?.aborted) throw new Error('transfer aborted');
      this.onChunk?.(path, offset);
      yield node.content.subarray(offset, Math.min(offset + CHUNK, limit));
    }
    if (failsAfter !== undefined && failsAfter <= node.content.length) {
      throw fault?.kind === 'stall'
        ? new ConnectionError('stalled', 'no data from the source')
        : new ConnectionError('failed', 'read failed');
    }
  }

  async readNamedStream(
    _target: ConnectionTarget,
    path: string,
    streamName: string,
    maxBytes: number,
  ): Promise<string | null> {
    this.calls.push(`readNamedStream ${path}:${streamName}`);
    this.assertReachable();
    const stream = this.require(path).streams.find(
      (s) => s.name === streamName,
    );

    return stream
      ? stream.content.subarray(0, maxBytes).toString('utf8')
      : null;
  }

  // --- internals ----------------------------------------------------------

  private put(
    path: string,
    isDirectory: boolean,
    content: Buffer,
    options: Times & { attributes?: string; unlistable?: boolean },
  ): Node {
    const canonical = normalizeWindowsPath(path);
    const node: Node = {
      path: canonical.path,
      isDirectory,
      content,
      times: {
        createdAt: options.createdAt ?? DEFAULT_TIME,
        modifiedAt: options.modifiedAt ?? DEFAULT_TIME,
        accessedAt: options.accessedAt ?? DEFAULT_TIME,
        changedAt: options.changedAt ?? DEFAULT_TIME,
      },
      attributes: options.attributes ?? (isDirectory ? 'D' : 'A'),
      streams: [],
      reparse: false,
      unlistable: options.unlistable ?? false,
      listed: true,
    };

    this.nodes.set(canonical.normalizedPath, node);

    return node;
  }

  private ensureParents(path: string): void {
    let parent = windowsPathParent(normalizeWindowsPath(path).path);

    while (parent && !this.nodes.has(key(parent))) {
      this.put(parent, true, Buffer.alloc(0), {});
      parent = windowsPathParent(parent);
    }
  }

  private require(path: string): Node {
    const node = this.nodes.get(key(path));

    if (!node) {
      throw new ConnectionError('not_found', 'File not found on the source');
    }

    return node;
  }

  private requireListable(path: string): void {
    const node = this.require(path);

    if (!node.isDirectory || node.unlistable) {
      throw new ConnectionError(
        node.isDirectory ? 'auth' : 'not_found',
        'cannot list',
      );
    }
  }

  private childrenOf(path: string): Node[] {
    const parent = key(path);

    return [...this.nodes.values()]
      .filter((node) => {
        const p = windowsPathParent(node.path);

        return p !== null && key(p) === parent;
      })
      .sort((a, b) => (a.path < b.path ? -1 : 1));
  }

  private assertReachable(): void {
    if (this.unreachable) {
      throw new ConnectionError('unreachable', 'machine is off');
    }
  }

  private nextFault(path: string): FakeFault | undefined {
    const list = this.faults.get(key(path));
    const fault = list?.[0];

    if (!list || !fault) return undefined;
    if (fault.times !== undefined) {
      if (fault.times <= 1) list.shift();
      else fault.times -= 1;
    }

    return fault;
  }
}
