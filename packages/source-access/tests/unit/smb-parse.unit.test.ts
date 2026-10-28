import {
  SmbTreeParser,
  parseAllinfoOutput,
} from '../../src/connections/smb-parse';
import type { TreeEntry } from '../../src/connections/types';

const parseTree = (root: string, output: string): TreeEntry[] => {
  const parser = new SmbTreeParser(root);

  return output
    .split('\n')
    .map((line) => parser.push(line))
    .filter((entry): entry is TreeEntry => entry !== null);
};

describe('SmbTreeParser', () => {
  const root = 'pabbo_000\\Documents\\ZeldaClone';
  const listing = [
    '  .                                   D        0  Mon Apr 25 15:57:01 2016',
    '  ..                                  D        0  Mon Apr 25 15:57:01 2016',
    '  ZeldaClone-0                        D        0  Mon Apr 25 15:57:01 2016',
    '  read me.txt                         A      158  Mon Apr 25 15:56:04 2016',
    '',
    '\\pabbo_000\\Documents\\ZeldaClone\\ZeldaClone-0',
    '  .                                   D        0  Mon Apr 25 15:57:01 2016',
    '  ..                                  D        0  Mon Apr 25 15:57:01 2016',
    '  help.rtf                            AHS     1553  Sat Jan  2 03:04:05 2021',
    '',
    '\\pabbo_000\\Documents\\ZeldaClone\\ZeldaClone-0\\sub dir',
    '  x.bin                               A        0  Mon Apr 25 15:57:01 2016',
  ].join('\n');

  it('returns paths relative to the root, depth by depth', () => {
    expect(parseTree(root, listing).map((e) => e.relPath)).toEqual([
      'ZeldaClone-0',
      'read me.txt',
      'ZeldaClone-0\\help.rtf',
      'ZeldaClone-0\\sub dir\\x.bin',
    ]);
  });

  it('parses flags, size and the write time as UTC', () => {
    const entries = parseTree(root, listing);

    expect(entries[0]).toMatchObject({ isDirectory: true, attributes: 'D' });
    expect(entries[2]).toMatchObject({
      kind: 'entry',
      name: 'help.rtf',
      attributes: 'AHS',
      size: 1553,
      modifiedAt: new Date('2021-01-02T03:04:05Z'),
    });
  });

  it('matches the root case-insensitively', () => {
    const entries = parseTree('PABBO_000\\documents\\zeldaclone', listing);

    expect(entries[2].relPath).toBe('ZeldaClone-0\\help.rtf');
  });

  it('reports a directory it could not list', () => {
    const entries = parseTree(
      root,
      [
        '  a                                   D        0  Mon Apr 25 15:57:01 2016',
        'NT_STATUS_ACCESS_DENIED listing \\pabbo_000\\Documents\\ZeldaClone\\a\\*',
      ].join('\n'),
    );

    expect(entries[1]).toEqual({
      kind: 'error',
      relPath: 'a',
      code: 'auth',
      message: 'NT_STATUS_ACCESS_DENIED',
    });
  });

  it('reports a failure of the root with an empty path', () => {
    const entries = parseTree(
      root,
      'NT_STATUS_OBJECT_NAME_NOT_FOUND listing \\pabbo_000\\Documents\\ZeldaClone\\*',
    );

    expect(entries[0]).toMatchObject({
      kind: 'error',
      relPath: '',
      code: 'not_found',
    });
  });

  it('lists the share root', () => {
    expect(
      parseTree(
        '',
        '  a.txt                               A        3  Mon Apr 25 15:57:01 2016',
      )[0].relPath,
    ).toBe('a.txt');
  });
});

describe('parseAllinfoOutput', () => {
  const file = [
    'altname: BRANDC~1.ZIP',
    'create_time:    Fri Oct 23 15:30:23 2026 UTC',
    'access_time:    Fri Oct 23 15:30:26 2026 UTC',
    'write_time:     Wed Sep 20 03:20:03 2017 UTC',
    'change_time:    Mon Sep  9 09:54:58 2019 UTC',
    'attributes: A (20)',
    'stream: [::$DATA], 547027116 bytes',
    'stream: [:Zone.Identifier:$DATA], 194 bytes',
  ].join('\n');
  const directory = [
    'altname: ZE7A13~1',
    'create_time:    Mon Apr 25 15:57:01 2016 UTC',
    'access_time:    Wed Oct 28 18:31:54 2026 UTC',
    'write_time:     Mon Apr 25 15:57:01 2016 UTC',
    'change_time:    Mon Apr 25 15:57:01 2016 UTC',
    'attributes: D (10)',
  ].join('\n');
  const missing =
    'NT_STATUS_OBJECT_NAME_NOT_FOUND getting alt name for \\pabbo_000\\nope.txt';

  it('parses times, attributes, size and streams', () => {
    const [block] = parseAllinfoOutput(file);

    expect(block).toEqual({
      ok: true,
      info: {
        isDirectory: false,
        size: 547027116,
        createdAt: new Date('2026-10-23T15:30:23Z'),
        accessedAt: new Date('2026-10-23T15:30:26Z'),
        modifiedAt: new Date('2017-09-20T03:20:03Z'),
        changedAt: new Date('2019-09-09T09:54:58Z'),
        attributes: 'A',
        attributeBits: 0x20,
        streams: [{ name: 'Zone.Identifier', size: 194 }],
        isReparsePoint: false,
      },
    });
  });

  it('gives one block per path, a failure in place', () => {
    const blocks = parseAllinfoOutput([file, missing, directory].join('\n'));

    expect(blocks.map((b) => b.ok)).toEqual([true, false, true]);
    expect(blocks[1]).toMatchObject({ ok: false, code: 'not_found' });
    expect(blocks[2]).toMatchObject({
      ok: true,
      info: { isDirectory: true, size: 0, streams: [] },
    });
  });

  it('splits blocks that have no short name', () => {
    const noAlt = file.split('\n').slice(1).join('\n');

    expect(parseAllinfoOutput([noAlt, noAlt].join('\n'))).toHaveLength(2);
  });

  it('reads the reparse bit from the hex attributes', () => {
    const [block] = parseAllinfoOutput(
      directory.replace('attributes: D (10)', 'attributes: HD (412)'),
    );

    expect(block).toMatchObject({ ok: true, info: { isReparsePoint: true } });
  });

  it('refuses times in another zone', () => {
    expect(() => parseAllinfoOutput(file.replace(/UTC/g, 'CST'))).toThrow(
      'expected UTC',
    );
  });
});
