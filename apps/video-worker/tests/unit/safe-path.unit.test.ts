import path from 'path';
import { resolveWithinRoot } from '../../src/lib/safe-path';

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
