export type ZipEntry = {
  path: string;
  size: number;
  compressedSize: number;
  /** ISO timestamp; zips store local time without a zone. */
  modifiedAt: string | null;
  isDirectory: boolean;
  encrypted: boolean;
};

export type CentralDirectory = {
  /** Where the central directory starts in the file. */
  offset: number;
  /** Its length in bytes. */
  size: number;
  /** Entries it declares. */
  entries: number;
};

/** The end-of-central-directory record is 22 bytes plus a comment of up to 65535. */
export const EOCD_SEARCH_BYTES = 22 + 0xffff;

const EOCD = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_EOCD = 0x06064b50;
const CENTRAL_HEADER = 0x02014b50;

const CENTRAL_HEADER_BYTES = 46;
const ZIP64_EXTRA = 0x0001;
const UTF8_FLAG = 0x0800;
const ENCRYPTED_FLAG = 0x0001;

const notZip = (detail: string) => new Error(`not a readable zip (${detail})`);

/**
 * Finds the central directory from the last bytes of a zip (`tail`), which
 * must reach the end of the file whose total size is `fileSize`. Follows the
 * Zip64 records when the 32-bit fields are saturated.
 */
export const locateCentralDirectory = (
  tail: Buffer,
  fileSize: number,
): CentralDirectory => {
  let eocd = -1;

  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) !== EOCD) continue;
    // A comment may contain the signature; the real record's comment length
    // reaches exactly to the end of the file.
    if (i + 22 + tail.readUInt16LE(i + 20) === tail.length) {
      eocd = i;
      break;
    }
  }

  if (eocd < 0) throw notZip('no end-of-central-directory record');

  let entries = tail.readUInt16LE(eocd + 10);
  let size = tail.readUInt32LE(eocd + 12);
  let offset = tail.readUInt32LE(eocd + 16);

  const saturated =
    entries === 0xffff || size === 0xffffffff || offset === 0xffffffff;

  if (saturated) {
    const locator = eocd - 20;

    if (locator < 0 || tail.readUInt32LE(locator) !== ZIP64_LOCATOR) {
      throw notZip('missing Zip64 locator');
    }

    const record =
      Number(tail.readBigUInt64LE(locator + 8)) - (fileSize - tail.length);

    if (record < 0 || record + 56 > tail.length) {
      throw notZip('Zip64 record is outside the data read');
    }
    if (tail.readUInt32LE(record) !== ZIP64_EOCD) {
      throw notZip('bad Zip64 record');
    }

    entries = Number(tail.readBigUInt64LE(record + 32));
    size = Number(tail.readBigUInt64LE(record + 40));
    offset = Number(tail.readBigUInt64LE(record + 48));
  }

  if (offset + size > fileSize) throw notZip('central directory out of range');

  return { offset, size, entries };
};

const dosDateTime = (date: number, time: number): string | null => {
  if (date === 0) return null;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    `${1980 + (date >> 9)}-${pad((date >> 5) & 0xf)}-${pad(date & 0x1f)}` +
    `T${pad(time >> 11)}:${pad((time >> 5) & 0x3f)}:${pad((time & 0x1f) * 2)}`
  );
};

/** Reads the 8-byte sizes the Zip64 extra field holds in place of saturated header values. */
const zip64Sizes = (
  extra: Buffer,
  needUncompressed: boolean,
  needCompressed: boolean,
): { size?: number; compressedSize?: number } => {
  for (let i = 0; i + 4 <= extra.length; ) {
    const id = extra.readUInt16LE(i);
    const length = extra.readUInt16LE(i + 2);

    if (id === ZIP64_EXTRA) {
      let at = i + 4;
      const result: { size?: number; compressedSize?: number } = {};

      if (needUncompressed && at + 8 <= i + 4 + length) {
        result.size = Number(extra.readBigUInt64LE(at));
        at += 8;
      }
      if (needCompressed && at + 8 <= i + 4 + length) {
        result.compressedSize = Number(extra.readBigUInt64LE(at));
      }

      return result;
    }

    i += 4 + length;
  }

  return {};
};

/**
 * Reads up to `limit` entries from a central directory's bytes. Names are
 * UTF-8 when the entry says so; otherwise latin1, which is right for ASCII
 * and close enough for the legacy code page.
 */
export const parseCentralDirectory = (
  directory: Buffer,
  declaredEntries: number,
  limit: number,
): ZipEntry[] => {
  const entries: ZipEntry[] = [];
  let at = 0;

  while (entries.length < Math.min(declaredEntries, limit)) {
    if (
      at + CENTRAL_HEADER_BYTES > directory.length ||
      directory.readUInt32LE(at) !== CENTRAL_HEADER
    ) {
      throw notZip('bad central directory entry');
    }

    const flags = directory.readUInt16LE(at + 8);
    const time = directory.readUInt16LE(at + 12);
    const date = directory.readUInt16LE(at + 14);
    const compressed32 = directory.readUInt32LE(at + 20);
    const size32 = directory.readUInt32LE(at + 24);
    const nameLength = directory.readUInt16LE(at + 28);
    const extraLength = directory.readUInt16LE(at + 30);
    const commentLength = directory.readUInt16LE(at + 32);
    const nameStart = at + CENTRAL_HEADER_BYTES;
    const extraStart = nameStart + nameLength;
    const next = extraStart + extraLength + commentLength;

    if (next > directory.length) throw notZip('truncated central directory');

    const path = directory
      .subarray(nameStart, extraStart)
      .toString(flags & UTF8_FLAG ? 'utf8' : 'latin1');
    const big = zip64Sizes(
      directory.subarray(extraStart, extraStart + extraLength),
      size32 === 0xffffffff,
      compressed32 === 0xffffffff,
    );

    entries.push({
      path,
      size: big.size ?? size32,
      compressedSize: big.compressedSize ?? compressed32,
      modifiedAt: dosDateTime(date, time),
      isDirectory: path.endsWith('/'),
      encrypted: (flags & ENCRYPTED_FLAG) !== 0,
    });

    at = next;
  }

  return entries;
};
