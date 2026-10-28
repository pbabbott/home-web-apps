import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { DestFs, defaultDestFsDeps } from '../../src/copy/dest-fs';
import { DestConflictError, DestWriteError } from '../../src/copy/errors';
import { UnsafePathError } from '../../src/lib/safe-path';

async function* chunks(...parts: string[]) {
  for (const part of parts) yield Buffer.from(part);
}

describe('DestFs', () => {
  let mount: string;
  let base: string;
  let dest: DestFs;

  beforeEach(async () => {
    mount = await fs.mkdtemp(path.join(os.tmpdir(), 'dest-fs-'));
    base = path.join(mount, 'root');
    await fs.mkdir(base);
    dest = new DestFs(mount, base);
  });

  afterEach(() => fs.rm(mount, { recursive: true, force: true }));

  describe('stage', () => {
    it('writes the chunks and returns their SHA-256 and size', async () => {
      const file = path.join(base, '.exodus-staging', 'item', '1');
      const result = await dest.stage(file, chunks('hel', 'lo'));

      expect(await fs.readFile(file, 'utf8')).toBe('hello');
      expect(result).toEqual({
        bytes: 5,
        sha256:
          '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      });
    });

    it('replaces a leftover of an earlier attempt', async () => {
      const file = path.join(base, 'staged');

      await fs.writeFile(file, 'old and longer');
      await dest.stage(file, chunks('new'));

      expect(await fs.readFile(file, 'utf8')).toBe('new');
    });

    it('lets an error of the source pass through unchanged', async () => {
      const boom = new Error('source died');
      const source = (async function* () {
        yield Buffer.from('a');
        throw boom;
      })();

      await expect(dest.stage(path.join(base, 'staged'), source)).rejects.toBe(
        boom,
      );
    });

    it('calls onChunk after every chunk', async () => {
      const seen: number[] = [];

      await dest.stage(path.join(base, 'staged'), chunks('a', 'b', 'c'), () => {
        seen.push(seen.length);
      });

      expect(seen).toEqual([0, 1, 2]);
    });

    it('reports a failing write with its errno', async () => {
      const failing = new DestFs(mount, base, {
        fs: {
          ...fs,
          open: async () =>
            ({
              write: async () => {
                throw Object.assign(new Error('no space'), { code: 'ENOSPC' });
              },
              sync: async () => undefined,
              close: async () => undefined,
            }) as never,
          mkdir: fs.mkdir,
        } as never,
        run: (_op, fn) => fn(),
      });

      await expect(
        failing.stage(path.join(base, 'staged'), chunks('x')),
      ).rejects.toMatchObject({ name: 'DestWriteError', code: 'ENOSPC' });
    });
  });

  describe('hashFile', () => {
    it('hashes a file larger than one read', async () => {
      const content = Buffer.alloc(2.5 * 1024 * 1024, 3);
      const file = path.join(base, 'big');

      await fs.writeFile(file, content);
      const staged = await dest.stage(
        path.join(base, 'copy'),
        (async function* () {
          yield content;
        })(),
      );

      expect(await dest.hashFile(file)).toEqual(staged);
    });
  });

  describe('link', () => {
    it('links, and refuses to clobber an existing file', async () => {
      await fs.writeFile(path.join(base, 'from'), 'one');
      await fs.writeFile(path.join(base, 'taken'), 'two');

      expect(
        await dest.link(path.join(base, 'from'), path.join(base, 'to')),
      ).toBe(true);
      expect(
        await dest.link(path.join(base, 'from'), path.join(base, 'taken')),
      ).toBe(false);
      expect(await fs.readFile(path.join(base, 'taken'), 'utf8')).toBe('two');
    });
  });

  describe('ensureDir', () => {
    it('creates missing parents below the base folder', async () => {
      await dest.ensureDir(path.join(base, 'a', 'b', 'c'));

      expect(
        (await fs.stat(path.join(base, 'a', 'b', 'c'))).isDirectory(),
      ).toBe(true);
    });

    it('accepts directories that exist', async () => {
      await fs.mkdir(path.join(base, 'a'));

      await expect(
        dest.ensureDir(path.join(base, 'a')),
      ).resolves.toBeUndefined();
    });

    it('refuses a symlink anywhere on the way', async () => {
      const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'outside-'));

      try {
        await fs.symlink(outside, path.join(base, 'link'));

        await expect(
          dest.ensureDir(path.join(base, 'link', 'x')),
        ).rejects.toBeInstanceOf(UnsafePathError);
        expect(await fs.readdir(outside)).toEqual([]);
      } finally {
        await fs.rm(outside, { recursive: true, force: true });
      }
    });

    it('reports a file where a directory must be', async () => {
      await fs.writeFile(path.join(base, 'a'), 'file');

      await expect(
        dest.ensureDir(path.join(base, 'a', 'b')),
      ).rejects.toBeInstanceOf(DestConflictError);
    });

    it('refuses a path outside the base folder', async () => {
      await expect(
        dest.ensureDir(path.join(mount, 'other')),
      ).rejects.toBeInstanceOf(UnsafePathError);
    });
  });

  describe('assertBaseSafe', () => {
    it('refuses a base folder reached through a symlink', async () => {
      const real = path.join(mount, 'real');

      await fs.mkdir(real);
      await fs.symlink(real, path.join(mount, 'linked'));
      const linked = new DestFs(mount, path.join(mount, 'linked'));

      await expect(linked.assertBaseSafe()).rejects.toBeInstanceOf(
        UnsafePathError,
      );
    });
  });

  describe('lstat', () => {
    it('answers null for a missing path', async () => {
      expect(await dest.lstat(path.join(base, 'nope'))).toBeNull();
    });

    it('wraps other errors with their errno', async () => {
      const failing = new DestFs(mount, base, {
        fs: {
          ...fs,
          lstat: async () => {
            throw Object.assign(new Error('io'), { code: 'EIO' });
          },
        } as never,
        run: (_op, fn) => fn(),
      });

      await expect(failing.lstat(base)).rejects.toBeInstanceOf(DestWriteError);
    });
  });

  describe('staging cleanup', () => {
    it('removes an item folder and the staging root once empty', async () => {
      const item = path.join(base, '.exodus-staging', 'item');

      await fs.mkdir(item, { recursive: true });
      await fs.writeFile(path.join(item, '1'), 'x');

      await dest.removeItemStaging(item);
      await dest.removeStagingRootIfEmpty();

      expect(await fs.readdir(base)).toEqual([]);
    });

    it('leaves the staging root while another item uses it', async () => {
      await fs.mkdir(path.join(base, '.exodus-staging', 'other'), {
        recursive: true,
      });

      await dest.removeStagingRootIfEmpty();

      expect(await fs.readdir(base)).toEqual(['.exodus-staging']);
    });
  });

  it('runs every call under the supplied wrapper', async () => {
    const operations: string[] = [];
    const watched = new DestFs(
      mount,
      base,
      defaultDestFsDeps(async (operation, fn) => {
        operations.push(operation);

        return fn();
      }),
    );

    await watched.stage(path.join(base, 'x'), chunks('a'));

    expect(operations).toEqual(
      expect.arrayContaining(['mkdir', 'open', 'write', 'fsync', 'close']),
    );
  });
});
