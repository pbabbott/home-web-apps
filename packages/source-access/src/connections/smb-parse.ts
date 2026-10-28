import type { ConnectionError, FileInfo, TreeEntry } from './types';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// `  name with spaces   AH   1234  Tue Mar  4 10:11:12 2025`
const LS_LINE =
  /^ {2}(.+?)\s+([ADHSRNI]*)\s+(\d+)\s+\w{3} (\w{3}) ([ \d]\d) (\d\d:\d\d:\d\d) (\d{4})$/;

const utc = (
  month: string,
  day: string,
  time: string,
  year: string,
): Date | null => {
  const monthIndex = MONTHS.indexOf(month);
  if (monthIndex < 0) return null;
  const [h, m, s] = time.split(':').map(Number);

  return new Date(Date.UTC(Number(year), monthIndex, Number(day), h, m, s));
};

/** NT status to the code a caller can act on. */
export const errorCodeOf = (output: string): ConnectionError['code'] => {
  if (/LOGON_FAILURE|ACCOUNT_LOCKED_OUT|ACCESS_DENIED/.test(output)) {
    return 'auth';
  }
  if (/NOT_FOUND/.test(output)) return 'not_found';
  if (/BAD_NETWORK_NAME/.test(output)) return 'no_share';
  if (/UNREACHABLE|IO_TIMEOUT|CONNECTION_REFUSED|UNSUCCESSFUL/.test(output)) {
    return 'unreachable';
  }

  return 'failed';
};

const LISTING_ERROR = /^(NT_STATUS_[A-Z_]+) listing (.+)$/;

/**
 * Incremental parser of `recurse ON; ls "<root>\*"` output. Feed it lines; it
 * returns the entry (or the listing error) a line describes, null otherwise.
 * A line starting with a backslash names the directory the following entries
 * belong to; the first directory (the root) has no such line. `.` and `..`
 * are dropped. Paths are relative to `rootPath` (the share-relative path that
 * was listed), compared case-insensitively.
 */
export class SmbTreeParser {
  private dir = '';
  private readonly rootPrefix: string;

  constructor(rootPath: string) {
    this.rootPrefix = rootPath.replace(/^\\+|\\+$/g, '').toLowerCase();
  }

  private relative(path: string): string {
    const trimmed = path.replace(/^\\+/, '').replace(/\\\*$/, '');
    const lower = trimmed.toLowerCase();

    if (lower === this.rootPrefix) return '';
    if (this.rootPrefix === '') return trimmed;
    if (lower.startsWith(`${this.rootPrefix}\\`)) {
      return trimmed.slice(this.rootPrefix.length + 1);
    }

    return trimmed;
  }

  push(line: string): TreeEntry | null {
    const text = line.replace(/\r$/, '');

    if (text.startsWith('\\')) {
      this.dir = this.relative(text);

      return null;
    }

    const failure = LISTING_ERROR.exec(text);
    if (failure) {
      return {
        kind: 'error',
        relPath: this.relative(failure[2]),
        code: errorCodeOf(failure[1]),
        message: failure[1],
      };
    }

    const match = LS_LINE.exec(text);
    if (!match) return null;

    const [, name, flags, size, month, day, time, year] = match;
    if (name === '.' || name === '..') return null;

    return {
      kind: 'entry',
      relPath: this.dir ? `${this.dir}\\${name}` : name,
      name,
      isDirectory: flags.includes('D'),
      size: Number(size),
      modifiedAt: utc(month, day.trim(), time, year),
      attributes: flags,
    };
  }
}

// `create_time:    Fri Oct 23 15:30:23 2026 UTC`
const TIME_LINE =
  /^(create|access|write|change)_time:\s+\w{3} (\w{3}) ([ \d]\d) (\d\d:\d\d:\d\d) (\d{4}) (\w+)$/;
const ATTRIBUTES_LINE = /^attributes:\s*([A-Z]*)\s+\(([0-9a-fA-F]+)\)$/;
const STREAM_LINE = /^stream: \[(.*?)\], (\d+) bytes$/;
const REPARSE_POINT = 0x400;
const DIRECTORY = 0x10;

type Block = {
  times: BlockTimes;
  attributes?: string;
  attributeBits?: number;
  streams: { name: string; size: number }[];
  size?: number;
};
type BlockTimes = Record<'create' | 'access' | 'write' | 'change', Date>;

const finish = (block: Block | null): FileInfo | null => {
  const t = block?.times;
  if (
    !block ||
    !t?.create ||
    !t.access ||
    !t.write ||
    !t.change ||
    block.attributeBits === undefined
  ) {
    return null;
  }

  const isDirectory = (block.attributeBits & DIRECTORY) !== 0;

  return {
    isDirectory,
    size: block.size ?? 0,
    createdAt: t.create,
    accessedAt: t.access,
    modifiedAt: t.write,
    changedAt: t.change,
    attributes: block.attributes ?? '',
    attributeBits: block.attributeBits,
    streams: block.streams,
    isReparsePoint: (block.attributeBits & REPARSE_POINT) !== 0,
  };
};

export type AllinfoBlock =
  | { ok: true; info: FileInfo }
  | { ok: false; code: ConnectionError['code']; message: string };

/**
 * Splits the output of several `allinfo` commands into one block per path, in
 * order. A block starts at `altname:` (or at a second `create_time:` when a
 * volume prints no short name); a failure is one `NT_STATUS_...` line. Times
 * must be printed in UTC (the child runs with `TZ=UTC`); any other zone is
 * refused, because mixing zones would silently shift every timestamp.
 */
export const parseAllinfoOutput = (output: string): AllinfoBlock[] => {
  const blocks: AllinfoBlock[] = [];
  const state: { current: Block | null } = { current: null };

  const close = () => {
    const info = finish(state.current);
    if (info) blocks.push({ ok: true, info });
    else if (state.current) {
      blocks.push({
        ok: false,
        code: 'failed',
        message: 'incomplete allinfo output',
      });
    }
    state.current = null;
  };
  const open = (): Block =>
    (state.current ??= { times: {} as BlockTimes, streams: [] });

  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith('altname:')) {
      close();
      open();
      continue;
    }

    const failure = /NT_STATUS_[A-Z_]+/.exec(line);
    if (failure) {
      close();
      blocks.push({
        ok: false,
        code: errorCodeOf(line),
        message: failure[0],
      });
      continue;
    }

    const time = TIME_LINE.exec(line);
    if (time) {
      const [, which, month, day, clock, year, zone] = time;
      if (zone !== 'UTC') {
        throw new Error(`allinfo printed ${zone} times; expected UTC`);
      }
      if (state.current?.times[which as keyof BlockTimes]) close();
      open().times[which as keyof BlockTimes] = utc(
        month,
        day.trim(),
        clock,
        year,
      ) as Date;
      continue;
    }

    const attributes = ATTRIBUTES_LINE.exec(line);
    if (attributes && state.current) {
      state.current.attributes = attributes[1];
      state.current.attributeBits = parseInt(attributes[2], 16);
      continue;
    }

    const stream = STREAM_LINE.exec(line);
    if (stream && state.current) {
      if (stream[1] === '::$DATA') state.current.size = Number(stream[2]);
      else {
        state.current.streams.push({
          name: stream[1].replace(/^:/, '').replace(/:\$DATA$/, ''),
          size: Number(stream[2]),
        });
      }
    }
  }
  close();

  return blocks;
};
