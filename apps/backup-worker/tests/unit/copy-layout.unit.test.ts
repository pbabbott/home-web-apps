import { EntryFailure } from '../../src/copy/errors';
import {
  destAbs,
  entryDestRel,
  entrySourcePath,
  keepBothRel,
  splitRelPath,
  stagingFile,
} from '../../src/copy/layout';
import {
  makeCarveOutMatcher,
  normalizeRelPath,
} from '../../src/copy/enumerate';
import { classifyFailures } from '../../src/copy/finish';

const JOB_ID = '1a2b3c4d-0000-4000-8000-000000000000';

describe('splitRelPath', () => {
  it('splits a Windows relative path and treats the root as empty', () => {
    expect(splitRelPath('')).toEqual([]);
    expect(splitRelPath('a\\b c\\d.txt')).toEqual(['a', 'b c', 'd.txt']);
  });

  it.each(['..\\x', 'a\\..\\b', 'a\\\\b', 'a\\.', 'a/b', 'a\0b'])(
    'refuses %j',
    (rel) => {
      expect(() => splitRelPath(rel)).toThrow(
        expect.objectContaining({ issueKind: 'unsupported_path' }),
      );
    },
  );

  it('refuses a name over 255 bytes, counted in bytes', () => {
    expect(() => splitRelPath('é'.repeat(128))).toThrow(
      expect.objectContaining({ issueKind: 'name_too_long' }),
    );
    expect(splitRelPath('é'.repeat(127))).toHaveLength(1);
  });
});

describe('entryDestRel', () => {
  it('appends the entry path to the item path with slashes', () => {
    expect(entryDestRel('C/Users/Me', 'Pictures\\a.jpg')).toBe(
      'C/Users/Me/Pictures/a.jpg',
    );
  });

  it('is the item path itself for the root entry', () => {
    expect(entryDestRel('C/Users/Me/a.jpg', '')).toBe('C/Users/Me/a.jpg');
  });
});

describe('entrySourcePath', () => {
  it('joins the item root and the relative path', () => {
    expect(entrySourcePath('C:\\Users\\Me', 'a\\b.txt')).toBe(
      'C:\\Users\\Me\\a\\b.txt',
    );
    expect(entrySourcePath('C:\\Users\\Me\\a.txt', '')).toBe(
      'C:\\Users\\Me\\a.txt',
    );
  });
});

describe('keepBothRel', () => {
  it('puts the first 8 characters of the job id before the extension', () => {
    expect(keepBothRel('C/Users/photo.jpg', JOB_ID)).toBe(
      'C/Users/photo.exodus-1a2b3c4d.jpg',
    );
  });

  it('suffixes only the last extension', () => {
    expect(keepBothRel('a/archive.tar.gz', JOB_ID)).toBe(
      'a/archive.tar.exodus-1a2b3c4d.gz',
    );
  });

  it('treats a leading dot as part of the name', () => {
    expect(keepBothRel('a/.bashrc', JOB_ID)).toBe('a/.bashrc.exodus-1a2b3c4d');
  });

  it('handles a name without a directory or extension', () => {
    expect(keepBothRel('notes', JOB_ID)).toBe('notes.exodus-1a2b3c4d');
  });

  it('refuses a result over 255 bytes', () => {
    expect(() => keepBothRel(`a/${'x'.repeat(250)}.txt`, JOB_ID)).toThrow(
      EntryFailure,
    );
  });
});

describe('destAbs', () => {
  it('resolves inside <base>/<source_dir_name>', () => {
    expect(destAbs('/mnt/dump/root', 'alpha', 'C/Users/a.txt')).toBe(
      '/mnt/dump/root/alpha/C/Users/a.txt',
    );
  });

  it.each(['../x', 'C/../../x', 'a/../../../x'])(
    'refuses %j that leaves the source folder',
    (rel) => {
      expect(() => destAbs('/mnt/dump', 'alpha', rel)).toThrow(
        expect.objectContaining({ issueKind: 'unsupported_path' }),
      );
    },
  );

  it('refuses a source folder name that is not a single name', () => {
    expect(() => destAbs('/mnt/dump', '../alpha', 'x')).toThrow(EntryFailure);
    expect(() => destAbs('/mnt/dump', 'a/b', 'x')).toThrow(EntryFailure);
    expect(() => destAbs('/mnt/dump', '', 'x')).toThrow(EntryFailure);
  });
});

describe('stagingFile', () => {
  it('lives under .exodus-staging/<item>/<entry>', () => {
    expect(stagingFile('/mnt/dump', 'item-1', 42)).toBe(
      '/mnt/dump/.exodus-staging/item-1/42',
    );
  });
});

describe('makeCarveOutMatcher', () => {
  const matcher = makeCarveOutMatcher('c:\\users\\me', [
    { path: 'C:\\Users\\Me\\Secret' },
    { path: 'C:\\Users\\Me\\Pictures\\Private' },
  ]);

  it('matches a carve-out and everything under it, ignoring case', () => {
    expect(matcher('secret')).toBe(true);
    expect(matcher('SECRET\\deep\\file.txt')).toBe(true);
    expect(matcher('Pictures\\private\\a.jpg')).toBe(true);
  });

  it('does not match siblings or names that merely start the same way', () => {
    expect(matcher('Secrets')).toBe(false);
    expect(matcher('Pictures\\a.jpg')).toBe(false);
    expect(matcher('Pictures')).toBe(false);
    expect(matcher('')).toBe(false);
  });

  it('matches nothing without carve-outs', () => {
    expect(makeCarveOutMatcher('c:\\users\\me', [])('anything')).toBe(false);
  });
});

describe('normalizeRelPath', () => {
  it('lowercases and keeps backslashes', () => {
    expect(normalizeRelPath('Pictures\\IMG.JPG')).toBe('pictures\\img.jpg');
  });
});

describe('classifyFailures', () => {
  const entry = (issueKind: string, relPath = 'a.txt') =>
    ({ relPath, issueKind, message: `${issueKind} happened` }) as never;

  it.each(['read_failed', 'write_failed', 'verify_mismatch'])(
    'retries when only %s failed',
    (kind) => {
      expect(classifyFailures([entry(kind)], 1).kind).toBe('transient');
    },
  );

  it.each([
    'source_missing',
    'name_too_long',
    'unsupported_path',
    'dest_conflict',
    'unlistable',
  ])('blocks the item for %s', (kind) => {
    expect(classifyFailures([entry(kind)], 1).kind).toBe('permanent');
  });

  it('is permanent when any one failure is, even among transient ones', () => {
    const { kind } = classifyFailures(
      [entry('read_failed'), entry('dest_conflict'), entry('read_failed')],
      3,
    );

    expect(kind).toBe('permanent');
  });

  it('names the counts per kind and the first failed entry', () => {
    const { error } = classifyFailures(
      [
        entry('read_failed', 'x\\1.bin'),
        entry('read_failed'),
        entry('write_failed'),
      ],
      5,
    );

    expect(error).toContain('5 entries failed');
    expect(error).toContain('read_failed (2)');
    expect(error).toContain('write_failed (1)');
    expect(error).toContain('x\\1.bin');
  });
});
