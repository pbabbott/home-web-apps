import fs from 'fs';
import { getBackupCoverage } from '@abbottland/homelab-db';
import { FakeDriver } from '@abbottland/source-access';
import { db } from '../../src/db';
import { DESTINATION_ID } from '../jest.integration.setup';
import {
  MODIFIED,
  bytes,
  destPath,
  entryMap,
  itemRow,
  jobStatus,
  makeAvailable,
  makeWorld,
  runUntilIdle,
  seconds,
  sha256,
  snapshot,
  useCopyWorld,
} from './helpers/copy-harness';

describe('copy engine', () => {
  useCopyWorld();

  describe('a directory item', () => {
    const root = 'C:\\data\\proj';
    const big = bytes(150_000, 9);
    const source = () =>
      new FakeDriver()
        .addDirectory(root, { modifiedAt: new Date('2010-01-01T00:00:00Z') })
        .addFile(`${root}\\a.txt`, 'alpha', { modifiedAt: MODIFIED })
        .addFile(`${root}\\sub\\b.bin`, big, {
          modifiedAt: new Date('2012-02-03T04:05:06Z'),
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

    it('copies the whole tree, empty directories and directory times included', async () => {
      const world = await makeWorld([{ rootPath: root, kind: 'directory' }]);

      await runUntilIdle(world.job.id, { driver: source() });

      const tree = snapshot(destPath(world.sourceDirName));

      expect(Object.keys(tree).sort()).toEqual([
        'C',
        'C/data',
        'C/data/proj',
        'C/data/proj/a.txt',
        'C/data/proj/empty',
        'C/data/proj/sub',
        'C/data/proj/sub/b.bin',
        'C/data/proj/sub/deeper',
        'C/data/proj/sub/deeper/c.txt',
      ]);
      expect(tree['C/data/proj/sub/b.bin']).toMatchObject({
        sha256: sha256(big),
        mtime: seconds(new Date('2012-02-03T04:05:06Z')),
      });
      // Writing children changes a directory's time; the source's time goes on last.
      expect(tree['C/data/proj']).toMatchObject({
        mtime: seconds(new Date('2010-01-01T00:00:00Z')),
      });
      expect(tree['C/data/proj/sub']).toMatchObject({
        mtime: seconds(new Date('2014-04-05T06:07:08Z')),
      });
      expect(tree['C/data/proj/empty']).toMatchObject({
        mtime: seconds(new Date('2011-11-11T11:11:11Z')),
      });

      expect(await itemRow(world.items[root].id)).toMatchObject({
        status: 'verified',
        enumerationComplete: true,
      });
      const entries = await entryMap(world.items[root].id);

      expect(Object.keys(entries).sort()).toEqual([
        '',
        'a.txt',
        'empty',
        'sub',
        'sub\\b.bin',
        'sub\\deeper',
        'sub\\deeper\\c.txt',
      ]);
      expect(Object.values(entries).every((e) => e.status === 'verified')).toBe(
        true,
      );
      expect(entries['sub\\b.bin']).toMatchObject({
        destRelPath: 'C/data/proj/sub/b.bin',
        sizeBytes: big.length,
      });
      expect(await jobStatus(world.job.id)).toBe('completed');
    });

    it('does not copy carve-outs, whole subtrees included', async () => {
      const world = await makeWorld([
        {
          rootPath: root,
          kind: 'directory',
          carveOuts: [
            {
              path: `${root}\\sub`,
              reason: 'rejected_item',
              refId: 'inventory-item-id',
            },
          ],
        },
      ]);

      await runUntilIdle(world.job.id, { driver: source() });

      expect(
        Object.keys(snapshot(destPath(world.sourceDirName))).sort(),
      ).toEqual([
        'C',
        'C/data',
        'C/data/proj',
        'C/data/proj/a.txt',
        'C/data/proj/empty',
      ]);
      expect(Object.keys(await entryMap(world.items[root].id)).sort()).toEqual([
        '',
        'a.txt',
        'empty',
      ]);
      expect((await itemRow(world.items[root].id)).status).toBe('verified');
    });

    it('verifies everything else when one descendant is unreadable, and a retry copies only that file', async () => {
      const driver = source().fault(`${root}\\sub\\b.bin`, {
        kind: 'error',
        afterBytes: 70_000,
        times: 1,
      });
      const world = await makeWorld([{ rootPath: root, kind: 'directory' }]);

      const first = await runUntilIdle(world.job.id, { driver });

      expect(first).toEqual(['settled', 'idle:retry_backoff']);
      let entries = await entryMap(world.items[root].id);

      expect(entries['sub\\b.bin']).toMatchObject({
        status: 'failed',
        issueKind: 'read_failed',
      });
      expect(
        Object.values(entries).filter((e) => e.status === 'verified'),
      ).toHaveLength(Object.keys(entries).length - 1);
      expect(await itemRow(world.items[root].id)).toMatchObject({
        status: 'queued',
        attemptCount: 1,
      });
      expect(driver.callsOf('open')).toHaveLength(3);
      expect(
        fs.existsSync(
          destPath(world.sourceDirName, 'C', 'data', 'proj', 'sub', 'b.bin'),
        ),
      ).toBe(false);
      expect(fs.existsSync(destPath('.exodus-staging'))).toBe(false);

      await makeAvailable(world.job.id);
      await runUntilIdle(world.job.id, { driver });

      // Only the missing file was read again.
      expect(driver.callsOf('open')).toHaveLength(4);
      expect(driver.callsOf('open')[3]).toContain('b.bin');
      entries = await entryMap(world.items[root].id);
      expect(entries['sub\\b.bin']).toMatchObject({
        status: 'verified',
        attempt: 2,
      });
      expect(await itemRow(world.items[root].id)).toMatchObject({
        status: 'verified',
        attemptCount: 2,
      });
      expect(
        sha256(
          fs.readFileSync(
            destPath(world.sourceDirName, 'C', 'data', 'proj', 'sub', 'b.bin'),
          ),
        ),
      ).toBe(sha256(big));
    });

    it('blocks the item for an unlistable directory but still copies the rest', async () => {
      const driver = source().addDirectory(`${root}\\locked`, {
        unlistable: true,
      });
      const world = await makeWorld([{ rootPath: root, kind: 'directory' }]);

      await runUntilIdle(world.job.id, { driver });

      expect((await entryMap(world.items[root].id))['locked']).toMatchObject({
        status: 'failed',
        issueKind: 'unlistable',
      });
      expect((await itemRow(world.items[root].id)).status).toBe('blocked');
      expect(
        fs.readFileSync(
          destPath(world.sourceDirName, 'C', 'data', 'proj', 'a.txt'),
          'utf8',
        ),
      ).toBe('alpha');
    });

    it('does not traverse a junction and records a not_followed entry', async () => {
      const driver = source()
        .addJunction(`${root}\\Cookies`)
        .addJunction(`${root}\\Hidden`, { listed: false });
      const world = await makeWorld([{ rootPath: root, kind: 'directory' }]);

      await runUntilIdle(world.job.id, { driver });

      const entries = await entryMap(world.items[root].id);

      expect(entries['Cookies']).toMatchObject({
        status: 'not_followed',
        issueKind: 'reparse_point_not_followed',
      });
      expect(entries['Hidden']).toBeUndefined();
      expect(
        fs.existsSync(
          destPath(world.sourceDirName, 'C', 'data', 'proj', 'Cookies'),
        ),
      ).toBe(false);
      // A junction that was left alone does not stop the item from being verified.
      expect((await itemRow(world.items[root].id)).status).toBe('verified');
    });

    it('blocks the item with source_missing when the directory is gone', async () => {
      const world = await makeWorld([{ rootPath: root, kind: 'directory' }]);

      await runUntilIdle(world.job.id, { driver: new FakeDriver() });

      expect((await itemRow(world.items[root].id)).status).toBe('blocked');
      expect((await entryMap(world.items[root].id))['']).toMatchObject({
        status: 'failed',
        issueKind: 'source_missing',
      });
    });

    it('lets the covering directory cover a nested approved item', async () => {
      const nested = `${root}\\a.txt`;
      const world = await makeWorld([
        { rootPath: root, kind: 'directory' },
        { rootPath: nested, redundantIn: root },
      ]);

      await runUntilIdle(world.job.id, { driver: source() });

      expect(await jobStatus(world.job.id)).toBe('completed');
      const report = await getBackupCoverage(db, {
        sourceId: world.sourceId,
        destinationId: DESTINATION_ID,
      });
      const buckets = Object.fromEntries(
        report.items.map((item) => [item.rootPath, item.bucket]),
      );

      expect(buckets[root]).toBe('covered');
      expect(buckets[nested]).toBe('redundant_covered');
      expect(report.allAccounted).toBe(true);
    });
  });
});
