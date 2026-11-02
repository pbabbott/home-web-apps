import {
  type AllinfoBlock,
  errorCodeOf,
  parseAllinfoOutput,
} from './smb-parse';
import { describeSmbError, runSmbclient } from './smb-process';
import {
  ConnectionError,
  type ConnectionTarget,
  type DirEntry,
  type FileInfo,
} from './types';

/**
 * Whether `allinfo` output describes a directory that exists. Windows answers
 * a listing of a folder the account may not list (an IIS app-pool profile,
 * say) with "not found", while `allinfo` on the same folder still works.
 */
export const reportsExistingDirectory = (allinfoOutput: string): boolean =>
  !/NT_STATUS_/.test(allinfoOutput) &&
  /^attributes:\s+[A-Z]*D[A-Z]*\s+\(/m.test(allinfoOutput);

// `  name with spaces   AH   1234  Tue Mar  4 10:11:12 2025`
const LS_LINE =
  /^ {2}(.+?)\s+([ADHSRNI]*)\s+(\d+)\s+\w{3} (\w{3}) ([ \d]\d) (\d\d:\d\d:\d\d) (\d{4})$/;
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

/** Parses `smbclient ls` output. Lines that are not entries (summary, errors) are ignored. */
export const parseSmbListing = (output: string): DirEntry[] => {
  const entries: DirEntry[] = [];

  for (const line of output.split(/\r?\n/)) {
    const match = LS_LINE.exec(line);

    if (!match) continue;

    const [, name, flags, size, month, day, time, year] = match;

    if (name === '.' || name === '..') continue;

    const monthIndex = MONTHS.indexOf(month);

    entries.push({
      name,
      isDirectory: flags.includes('D'),
      size: Number(size),
      modifiedAt:
        monthIndex < 0
          ? null
          : `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day.trim().padStart(2, '0')}T${time}`,
    });
  }

  return entries;
};

/** How many paths one `allinfo` session takes; ~26 ms each when measured. */
export const ALLINFO_BATCH_SIZE = 100;
/** Command text per session, well under the 128 KB argument limit. */
const ALLINFO_BATCH_BYTES = 64 * 1024;
// `in` rather than `ok`: apps compile this source without strictNullChecks,
// where unions discriminated on a literal do not narrow.
const blockToResult = (block: AllinfoBlock): FileInfo | ConnectionError =>
  'info' in block
    ? block.info
    : new ConnectionError(block.code, describeSmbError(block.message));

/** Splits `items` into batches by count and total command size. */
export const batchesOf = <T extends { command: string }>(items: T[]): T[][] => {
  const batches: T[][] = [];
  let current: T[] = [];
  let bytes = 0;

  for (const item of items) {
    const size = Buffer.byteLength(item.command);

    if (
      current.length > 0 &&
      (current.length >= ALLINFO_BATCH_SIZE ||
        bytes + size > ALLINFO_BATCH_BYTES)
    ) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += size;
  }
  if (current.length > 0) batches.push(current);

  return batches;
};

/**
 * `allinfo` for paths of one share. If the output does not hold one block
 * per path (one failure can hide a neighbour's block), the batch is redone
 * one path at a time, where the output belongs to a single path.
 */
export const allinfoShare = async (
  target: ConnectionTarget,
  share: string,
  relativePaths: string[],
): Promise<(FileInfo | ConnectionError)[]> => {
  const run = async (paths: string[]) => {
    const { output } = await runSmbclient(target, [
      `//${target.address}/${share}`,
      '-c',
      paths.map((path) => `allinfo "${path}"`).join(';'),
    ]);

    return { output, blocks: parseAllinfoOutput(output) };
  };

  const batch = await run(relativePaths);

  if (batch.blocks.length === relativePaths.length) {
    return batch.blocks.map(blockToResult);
  }

  const results: (FileInfo | ConnectionError)[] = [];

  for (const path of relativePaths) {
    const single = await run([path]);

    results.push(
      single.blocks.length === 1
        ? blockToResult(single.blocks[0])
        : new ConnectionError(
            errorCodeOf(single.output),
            describeSmbError(single.output),
          ),
    );
  }

  return results;
};
