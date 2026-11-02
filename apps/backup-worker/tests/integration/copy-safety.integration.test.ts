import fs from 'fs';
import os from 'os';
import path from 'path';
import { FakeDriver } from '@abbottland/source-access';
import { FaultInjectedError } from '../../src/copy/errors';
import { DESTINATION_PATH } from '../jest.integration.setup';
import {
  MODIFIED,
  bytes,
  cleanupWorld,
  destPath,
  entriesOf,
  entryMap,
  expireLeases,
  itemRow,
  jobStatus,
  makeWorld,
  resetDestination,
  runUntilIdle,
  snapshot,
  useCopyWorld,
} from './helpers/copy-harness';

describe('copy engine', () => {
  useCopyWorld();

  describe('safety', () => {
    it('writes nothing when the destination path escapes the source folder', async () => {
      const file = 'C:\\data\\a.txt';
      const world = await makeWorld([
        { rootPath: file, destRelPath: 'C/../../../escape.txt' },
      ]);

      await runUntilIdle(world.job.id, {
        driver: new FakeDriver().addFile(file, 'x'),
      });

      expect((await entriesOf(world.items[file].id))[0]).toMatchObject({
        status: 'failed',
        issueKind: 'unsupported_path',
      });
      expect((await itemRow(world.items[file].id)).status).toBe('blocked');
      expect(fs.readdirSync(DESTINATION_PATH)).toEqual([]);
      expect(
        fs.existsSync(path.join(DESTINATION_PATH, '..', 'escape.txt')),
      ).toBe(false);
    });

    it('writes nothing through a symlink in the destination', async () => {
      const file = 'C:\\data\\a.txt';
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));

      try {
        const world = await makeWorld([{ rootPath: file }]);

        fs.mkdirSync(destPath(world.sourceDirName, 'C'), { recursive: true });
        fs.symlinkSync(outside, destPath(world.sourceDirName, 'C', 'data'));

        await runUntilIdle(world.job.id, {
          driver: new FakeDriver().addFile(file, 'x'),
        });

        expect((await entriesOf(world.items[file].id))[0]).toMatchObject({
          status: 'failed',
          issueKind: 'unsupported_path',
        });
        expect(fs.readdirSync(outside)).toEqual([]);
        expect(fs.existsSync(destPath('.exodus-staging'))).toBe(false);
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    });

    it('fails the entry, without a keep-both copy, when the link keeps losing its race', async () => {
      const file = 'C:\\data\\a.txt';
      const world = await makeWorld([{ rootPath: file }]);

      await runUntilIdle(world.job.id, {
        driver: new FakeDriver().addFile(file, 'x'),
        fsDeps: {
          fs: {
            ...fs.promises,
            link: async () => {
              throw Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
            },
          } as never,
          run: <T>(_operation: string, fn: () => Promise<T>) => fn(),
        },
      });

      expect((await entriesOf(world.items[file].id))[0]).toMatchObject({
        status: 'failed',
        issueKind: 'dest_conflict',
      });
    });

    it('fails an entry whose name is too long for the destination', async () => {
      const file = `C:\\data\\${'n'.repeat(300)}.txt`;
      const world = await makeWorld([{ rootPath: file }]);

      await runUntilIdle(world.job.id, {
        driver: new FakeDriver().addFile(file, 'x'),
      });

      expect((await entriesOf(world.items[file].id))[0]).toMatchObject({
        status: 'failed',
        issueKind: 'name_too_long',
      });
      expect((await itemRow(world.items[file].id)).status).toBe('blocked');
    });

    it('leaves unrelated files and folders unread, unchanged and uncluttered', async () => {
      const root = 'C:\\data\\proj';
      const world = await makeWorld([{ rootPath: root, kind: 'directory' }]);

      fs.writeFileSync(destPath('junk.txt'), 'junk');
      fs.mkdirSync(destPath('other', 'deep'), { recursive: true });
      fs.writeFileSync(destPath('other', 'deep', 'x.bin'), bytes(1000));
      fs.utimesSync(
        destPath('other', 'deep', 'x.bin'),
        new Date('2005-05-05T05:05:05Z'),
        new Date('2005-05-05T05:05:05Z'),
      );
      const before = snapshot(DESTINATION_PATH);

      await runUntilIdle(world.job.id, {
        driver: new FakeDriver()
          .addFile(`${root}\\a.txt`, 'alpha')
          .addFile(`${root}\\sub\\b.txt`, 'beta'),
      });

      const after = snapshot(DESTINATION_PATH);
      const own = Object.keys(after).filter(
        (key) =>
          key === world.sourceDirName ||
          key.startsWith(`${world.sourceDirName}/`),
      );
      const rest = Object.fromEntries(
        Object.entries(after).filter(([key]) => !own.includes(key)),
      );

      expect(rest).toEqual(before);
      expect(fs.readdirSync(DESTINATION_PATH).sort()).toEqual(
        ['junk.txt', 'other', world.sourceDirName].sort(),
      );
      expect(own.length).toBeGreaterThan(1);
    });
  });

  describe('a worker killed at any point', () => {
    const root = 'C:\\data\\proj';
    const driver = () =>
      new FakeDriver()
        .addFile(`${root}\\a.txt`, 'alpha', { modifiedAt: MODIFIED })
        .addFile(`${root}\\sub\\b.bin`, bytes(200_000, 3), {
          modifiedAt: new Date('2012-02-03T04:05:06Z'),
          streams: [{ name: 'Zone.Identifier', content: '[ZoneTransfer]' }],
        })
        .addFile(`${root}\\sub\\deeper\\c.txt`, 'gamma', {
          modifiedAt: new Date('2013-03-04T05:06:07Z'),
        })
        .addDirectory(`${root}\\empty`, {
          modifiedAt: new Date('2011-11-11T11:11:11Z'),
        })
        .addDirectory(`${root}\\sub`, {
          modifiedAt: new Date('2014-04-05T06:07:08Z'),
        });

    /** A different file already at one destination path, so keep-both is on the path too. */
    const preexisting = (sourceDirName: string) => {
      const dir = destPath(sourceDirName, 'C', 'data', 'proj');

      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'a.txt'), 'someone else was here');
      fs.utimesSync(
        path.join(dir, 'a.txt'),
        new Date('2001-01-01T00:00:00Z'),
        new Date('2001-01-01T00:00:00Z'),
      );
    };

    /**
     * Directories above the item (`C`, `C/data`) get the time they were made;
     * that differs between runs and is not something the copy sets.
     */
    const stable = (tree: ReturnType<typeof snapshot>) =>
      Object.fromEntries(
        Object.entries(tree).map(([key, node]) => [
          // The keep-both suffix is the job's id, which differs per run.
          key.replace(/\.exodus-[0-9a-f]{8}/, '.exodus-JOB'),
          node.type === 'dir' && !key.startsWith('C/data/proj')
            ? { type: 'dir' }
            : node,
        ]),
      );

    const prepare = async () => {
      resetDestination();
      await cleanupWorld();
      const world = await makeWorld(
        [{ rootPath: root, kind: 'directory' }],
        'killtest',
      );

      preexisting(world.sourceDirName);

      return world;
    };

    it('produces the same tree as an uninterrupted run: no overwrite, no duplicate, no staging file', async () => {
      // Baseline, counting every fault point the run passes.
      let points = 0;
      const baselineWorld = await prepare();

      await runUntilIdle(baselineWorld.job.id, {
        driver: driver(),
        fault: () => {
          points += 1;
        },
      });
      const baseline = stable(snapshot(destPath('killtest')));

      expect(points).toBeGreaterThan(30);
      expect(await jobStatus(baselineWorld.job.id)).toBe('completed');
      expect(Object.keys(baseline)).toContain('C/data/proj/sub/b.bin');
      const keptBoth = Object.keys(baseline).filter((key) =>
        key.includes('.exodus-'),
      );

      expect(keptBoth).toHaveLength(1);

      for (let kill = 1; kill <= points; kill++) {
        const world = await prepare();
        let hits = 0;
        let died = '';

        await expect(
          runUntilIdle(world.job.id, {
            driver: driver(),
            fault: (point, detail) => {
              hits += 1;
              if (hits === kill) {
                died = `${point} ${detail ?? ''}`;
                throw new FaultInjectedError(point);
              }
            },
          }),
        ).rejects.toBeInstanceOf(FaultInjectedError);

        // The dead worker's lease runs out; another worker (a fresh run) takes over.
        await expireLeases(world.job.id);
        await runUntilIdle(world.job.id, {
          driver: driver(),
          skipBackoff: true,
        });

        const context = `killed at hit ${kill} (${died.trim()})`;
        const tree = stable(snapshot(destPath('killtest')));

        expect({ context, tree }).toEqual({ context, tree: baseline });
        expect({ context, root: fs.readdirSync(DESTINATION_PATH) }).toEqual({
          context,
          root: ['killtest'],
        });
        expect(
          fs.readFileSync(
            destPath('killtest', 'C', 'data', 'proj', 'a.txt'),
            'utf8',
          ),
        ).toBe('someone else was here');
        expect({
          context,
          status: (await itemRow(world.items[root].id)).status,
        }).toEqual({
          context,
          status: 'verified',
        });
        expect(
          Object.values(await entryMap(world.items[root].id)).every(
            (entry) => entry.status === 'verified',
          ),
        ).toBe(true);
      }
    }, 300_000);
  });
});
