import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  assertNoSymlinks,
  resolveWithinRoot,
  UnsafePathError,
} from '../../src/lib/safe-path';

describe('resolveWithinRoot', () => {
  const root = '/mnt/nas/media';

  it('resolves the root itself for an empty path', () => {
    expect(resolveWithinRoot(root, '')).toBe(root);
  });

  it('resolves a plain subdirectory', () => {
    expect(resolveWithinRoot(root, 'tv_shows')).toBe(
      path.join(root, 'tv_shows'),
    );
  });

  it('resolves a leading-slash path as relative to root, not absolute', () => {
    expect(resolveWithinRoot(root, '/tv_shows')).toBe(
      path.join(root, 'tv_shows'),
    );
  });

  it('rejects simple traversal out of root', () => {
    expect(resolveWithinRoot(root, '../etc')).toBeNull();
  });

  it('rejects deep traversal out of root', () => {
    expect(resolveWithinRoot(root, '../../../../../../root')).toBeNull();
  });

  it('rejects traversal buried inside a subpath', () => {
    expect(
      resolveWithinRoot(root, 'tv_shows/../../../../etc/passwd'),
    ).toBeNull();
  });

  it('treats an absolute-looking path as relative to root, never escaping it', () => {
    expect(resolveWithinRoot(root, '/etc/passwd')).toBe(
      path.join(root, 'etc/passwd'),
    );
  });

  it('rejects an absolute-looking path that traverses out via ..', () => {
    expect(resolveWithinRoot(root, '/../../etc/passwd')).toBeNull();
  });

  it('rejects null bytes', () => {
    expect(resolveWithinRoot(root, 'tv_shows\0/etc/passwd')).toBeNull();
  });

  it('allows a path that merely starts with the root prefix but is a sibling', () => {
    // /mnt/nas/media-other should NOT be treated as within /mnt/nas/media
    expect(resolveWithinRoot(root, '../media-other')).toBeNull();
  });
});

describe('assertNoSymlinks', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-path-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const lstat = (p: string) => fs.promises.lstat(p);

  it('accepts real directories and missing components', async () => {
    fs.mkdirSync(path.join(dir, 'a'));

    await expect(assertNoSymlinks(dir, dir, lstat)).resolves.toBeUndefined();
    await expect(
      assertNoSymlinks(dir, path.join(dir, 'a', 'b', 'c'), lstat),
    ).resolves.toBeUndefined();
  });

  it('rejects a symlinked component', async () => {
    fs.mkdirSync(path.join(dir, 'real'));
    fs.symlinkSync(path.join(dir, 'real'), path.join(dir, 'link'));

    await expect(
      assertNoSymlinks(dir, path.join(dir, 'link', 'x'), lstat),
    ).rejects.toThrow(UnsafePathError);
  });

  it('rejects a target outside the root', async () => {
    await expect(assertNoSymlinks(dir, os.tmpdir(), lstat)).rejects.toThrow(
      UnsafePathError,
    );
  });

  it('does not check the root itself', async () => {
    const link = path.join(os.tmpdir(), `root-link-${process.pid}`);
    fs.symlinkSync(dir, link);
    try {
      await expect(
        assertNoSymlinks(link, path.join(link, 'a'), lstat),
      ).resolves.toBeUndefined();
    } finally {
      fs.rmSync(link);
    }
  });
});

const os_tmp = () => require('os').tmpdir() as string;
