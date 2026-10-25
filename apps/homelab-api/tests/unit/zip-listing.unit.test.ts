import {
  locateCentralDirectory,
  parseCentralDirectory,
} from '../../src/lib/zip-listing';

type Fixture = {
  name: string;
  size?: number;
  flags?: number;
  /** Written as 0xFFFFFFFF with a Zip64 extra field. */
  zip64?: boolean;
  date?: number;
  time?: number;
};

const header = (entry: Fixture): Buffer => {
  const name = Buffer.from(
    entry.name,
    entry.flags && entry.flags & 0x800 ? 'utf8' : 'latin1',
  );
  const extra = Buffer.alloc(entry.zip64 ? 20 : 0);

  if (entry.zip64) {
    extra.writeUInt16LE(1, 0);
    extra.writeUInt16LE(16, 2);
    extra.writeBigUInt64LE(BigInt(entry.size ?? 0), 4);
    extra.writeBigUInt64LE(BigInt(entry.size ?? 0), 12);
  }

  const fixed = Buffer.alloc(46);
  fixed.writeUInt32LE(0x02014b50, 0);
  fixed.writeUInt16LE(entry.flags ?? 0, 8);
  fixed.writeUInt16LE(entry.time ?? 0, 12);
  fixed.writeUInt16LE(entry.date ?? 0, 14);
  fixed.writeUInt32LE(entry.zip64 ? 0xffffffff : (entry.size ?? 0), 20);
  fixed.writeUInt32LE(entry.zip64 ? 0xffffffff : (entry.size ?? 0), 24);
  fixed.writeUInt16LE(name.length, 28);
  fixed.writeUInt16LE(extra.length, 30);

  return Buffer.concat([fixed, name, extra]);
};

/** A zip with `body` bytes of fake file data, then the central directory. */
const zip = (entries: Fixture[], comment = '', body = 100) => {
  const directory = Buffer.concat(entries.map(header));
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(body, 16);
  eocd.writeUInt16LE(Buffer.byteLength(comment), 20);

  return {
    directory,
    file: Buffer.concat([
      Buffer.alloc(body),
      directory,
      eocd,
      Buffer.from(comment),
    ]),
  };
};

describe('zip listing', () => {
  it('lists entries with sizes, dates, directories and encryption', () => {
    const { file, directory } = zip([
      { name: 'docs/' },
      {
        name: 'docs/a.txt',
        size: 42,
        flags: 1,
        date: ((2024 - 1980) << 9) | (3 << 5) | 9,
        time: (13 << 11) | (5 << 5) | 15,
      },
    ]);
    const located = locateCentralDirectory(file, file.length);

    expect(located).toEqual({
      offset: 100,
      size: directory.length,
      entries: 2,
    });
    expect(parseCentralDirectory(directory, 2, 1000)).toEqual([
      {
        path: 'docs/',
        size: 0,
        compressedSize: 0,
        modifiedAt: null,
        isDirectory: true,
        encrypted: false,
      },
      {
        path: 'docs/a.txt',
        size: 42,
        compressedSize: 42,
        modifiedAt: '2024-03-09T13:05:30',
        isDirectory: false,
        encrypted: true,
      },
    ]);
  });

  it('reads UTF-8 names when the entry is flagged', () => {
    const { directory } = zip([{ name: 'café.txt', flags: 0x800 }]);

    expect(parseCentralDirectory(directory, 1, 10)[0]?.path).toBe('café.txt');
  });

  it('finds the record past a trailing comment, even one that contains the signature', () => {
    const { file } = zip([{ name: 'a' }], 'PK\u0005\u0006 not me');

    expect(locateCentralDirectory(file, file.length).entries).toBe(1);
  });

  it('reads Zip64 sizes from the extra field', () => {
    const { directory } = zip([
      { name: 'big.bin', size: 5_000_000_000, zip64: true },
    ]);
    const [entry] = parseCentralDirectory(directory, 1, 10);

    expect(entry?.size).toBe(5_000_000_000);
    expect(entry?.compressedSize).toBe(5_000_000_000);
  });

  it('stops at the limit', () => {
    const { directory } = zip([{ name: 'a' }, { name: 'b' }, { name: 'c' }]);

    expect(parseCentralDirectory(directory, 3, 2).map((e) => e.path)).toEqual([
      'a',
      'b',
    ]);
  });

  it('rejects data that is not a zip', () => {
    const junk = Buffer.alloc(200, 7);

    expect(() => locateCentralDirectory(junk, junk.length)).toThrow(
      'not a readable zip',
    );
    expect(() => parseCentralDirectory(junk, 1, 10)).toThrow(
      'not a readable zip',
    );
  });
});
