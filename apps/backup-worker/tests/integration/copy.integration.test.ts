import fs from 'fs';
import os from 'os';
import path from 'path';
import { getBackupCoverage } from '@abbottland/homelab-db';
import { FakeDriver } from '@abbottland/source-access';
import { FaultInjectedError } from '../../src/copy/errors';
import { db } from '../../src/db';
import { DESTINATION_ID, DESTINATION_PATH } from '../jest.integration.setup';
import {
  bytes,
  cleanupWorld,
  createDestinationRow,
  deleteDestinationRow,
  destPath,
  entriesOf,
  entryMap,
  expireLeases,
  itemRow,
  jobStatus,
  makeAvailable,
  makeWorld,
  resetDestination,
  runUntilIdle,
  sha256,
  snapshot,
} from './helpers/copy-harness';

const MODIFIED = new Date('2018-03-04T05:06:07Z');
const seconds = (date: Date) => Math.floor(date.getTime() / 1000);
const mtimeOf = (...parts: string[]) =>
  seconds(fs.statSync(destPath(...parts)).mtime);

describe('copy engine', () => {
  beforeAll(createDestinationRow);

  afterAll(async () => {
    await cleanupWorld();
    await deleteDestinationRow();
  });

  afterEach(async () => {
    await cleanupWorld();
    resetDestination();
  });

  describe('a file item', () => {
    const content = bytes(300_000);
    const file = 'C:\\data\\photo.jpg';
    const sourceFile = () =>
      new FakeDriver().addFile(file, content, {
        modifiedAt: MODIFIED,
        createdAt: new Date('2017-01-02T03:04:05Z'),
        accessedAt: new Date('2019-01-01T00:00:00Z'),
        changedAt: new Date('2018-06-07T08:09:10Z'),
        attributes: 'AH',
        streams: [
          {
            name: 'Zone.Identifier',
            content: '[ZoneTransfer]\r\nZoneId=3\r\n',
          },
        ],
      });

    it('is copied with the same hash and modified time, leaving no staging file', async () => {
      const driver = sourceFile();
      const world = await makeWorld([{ rootPath: file }]);

      const results = await runUntilIdle(world.job.id, { driver });

      expect(results).toEqual(['settled', 'idle:queue_empty']);
      const final = destPath(world.sourceDirName, 'C', 'data', 'photo.jpg');

      expect(sha256(fs.readFileSync(final))).toBe(sha256(content));
      expect(mtimeOf(world.sourceDirName, 'C', 'data', 'photo.jpg')).toBe(
        seconds(MODIFIED),
      );
      expect(fs.readdirSync(DESTINATION_PATH)).toEqual([world.sourceDirName]);

      expect((await itemRow(world.items[file].id)).status).toBe('verified');
      expect(await jobStatus(world.job.id)).toBe('completed');

      const entries = await entriesOf(world.items[file].id);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        relPath: '',
        entryType: 'file',
        status: 'verified',
        sizeBytes: content.length,
        sha256: sha256(content),
        destRelPath: 'C/data/photo.jpg',
        issueKind: null,
      });
    });

    it('records the source metadata as it was before the file was read', async () => {
      const driver = sourceFile();
      const world = await makeWorld([{ rootPath: file }]);

      await runUntilIdle(world.job.id, { driver });

      const [entry] = await entriesOf(world.items[file].id);

      expect(entry.srcCreatedAt).toEqual(new Date('2017-01-02T03:04:05Z'));
      expect(entry.srcModifiedAt).toEqual(MODIFIED);
      expect(entry.srcChangedAt).toEqual(new Date('2018-06-07T08:09:10Z'));
      expect(entry.srcAccessedAt).toEqual(new Date('2019-01-01T00:00:00Z'));
      expect(entry.srcAttributes).toBe('AH');
      expect(entry.srcStreams).toEqual([{ name: 'Zone.Identifier', size: 26 }]);
      expect(entry.srcZoneIdentifier).toBe('[ZoneTransfer]\r\nZoneId=3\r\n');
      // The copy moved the access time on the source; the database kept the original.
      expect(driver.timesOf(file).accessedAt.getTime()).toBeGreaterThan(
        new Date('2019-01-01T00:00:00Z').getTime(),
      );
    });

    it('describes the file before it reads it', async () => {
      const driver = sourceFile();
      const world = await makeWorld([{ rootPath: file }]);

      await runUntilIdle(world.job.id, { driver });

      const kinds = driver.calls.map((call) => call.split(' ')[0]);

      expect(kinds.indexOf('allinfo')).toBeGreaterThanOrEqual(0);
      expect(kinds.indexOf('allinfo')).toBeLessThan(kinds.indexOf('open'));
      expect(kinds.indexOf('readNamedStream')).toBeLessThan(
        kinds.indexOf('open'),
      );
    });

    it('fails with read_failed when the stream ends before the stat size, discarding the staged file', async () => {
      const driver = sourceFile().fault(file, {
        kind: 'short',
        bytes: 1000,
        times: 1,
      });
      const world = await makeWorld([{ rootPath: file }]);

      const results = await runUntilIdle(world.job.id, { driver });

      expect(results).toEqual(['settled', 'idle:retry_backoff']);
      const [entry] = await entriesOf(world.items[file].id);

      expect(entry).toMatchObject({
        status: 'failed',
        issueKind: 'read_failed',
        sha256: null,
      });
      expect(entry.message).toContain('1000 of 300000');
      expect(await itemRow(world.items[file].id)).toMatchObject({
        status: 'queued',
        attemptCount: 1,
      });
      expect(fs.readdirSync(DESTINATION_PATH)).toEqual([world.sourceDirName]);
      expect(
        fs.existsSync(destPath(world.sourceDirName, 'C', 'data', 'photo.jpg')),
      ).toBe(false);

      // The retry copies it.
      await makeAvailable(world.job.id);
      await runUntilIdle(world.job.id, { driver });

      expect(await itemRow(world.items[file].id)).toMatchObject({
        status: 'verified',
        attemptCount: 2,
      });
    });

    it('keeps the recorded source metadata when a retry runs', async () => {
      const driver = sourceFile().fault(file, {
        kind: 'short',
        bytes: 10,
        times: 1,
      });
      const world = await makeWorld([{ rootPath: file }]);
      const original = new Date('2019-01-01T00:00:00Z');

      await runUntilIdle(world.job.id, { driver });
      expect((await entriesOf(world.items[file].id))[0].srcAccessedAt).toEqual(
        original,
      );
      // By now the first attempt's read has moved the access time.
      expect(driver.timesOf(file).accessedAt.getTime()).toBeGreaterThan(
        original.getTime(),
      );

      await makeAvailable(world.job.id);
      await runUntilIdle(world.job.id, { driver });

      const [entry] = await entriesOf(world.items[file].id);

      expect(entry.status).toBe('verified');
      expect(entry.srcAccessedAt).toEqual(original);
      expect(entry.srcCreatedAt).toEqual(new Date('2017-01-02T03:04:05Z'));
    });

    it('is blocked with source_missing when the file is not on the source', async () => {
      const world = await makeWorld([{ rootPath: file }]);

      await runUntilIdle(world.job.id, { driver: new FakeDriver() });

      expect(await itemRow(world.items[file].id)).toMatchObject({
        status: 'blocked',
        attemptCount: 1,
      });
      expect((await entriesOf(world.items[file].id))[0]).toMatchObject({
        status: 'failed',
        issueKind: 'source_missing',
      });
      expect(fs.readdirSync(DESTINATION_PATH)).toEqual([]);
      expect(await jobStatus(world.job.id)).toBe('completed_with_issues');
    });
  });

  describe('existing destination files', () => {
    const content = bytes(80_000, 5);
    const file = 'C:\\data\\photo.jpg';
    const driver = () =>
      new FakeDriver().addFile(file, content, { modifiedAt: MODIFIED });
    const preexisting = (sourceDirName: string, data: Buffer | string) => {
      const dir = destPath(sourceDirName, 'C', 'data');

      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'photo.jpg'), data);
      fs.utimesSync(
        path.join(dir, 'photo.jpg'),
        new Date('2001-01-01T00:00:00Z'),
        new Date('2001-01-01T00:00:00Z'),
      );
    };

    it('adopts an identical file instead of writing a second one', async () => {
      const world = await makeWorld([{ rootPath: file }]);

      preexisting(world.sourceDirName, content);
      await runUntilIdle(world.job.id, { driver: driver() });

      expect(
        fs.readdirSync(destPath(world.sourceDirName, 'C', 'data')),
      ).toEqual(['photo.jpg']);
      expect((await entriesOf(world.items[file].id))[0]).toMatchObject({
        status: 'verified',
        destRelPath: 'C/data/photo.jpg',
        issueKind: null,
      });
      expect(mtimeOf(world.sourceDirName, 'C', 'data', 'photo.jpg')).toBe(
        seconds(MODIFIED),
      );
    });

    it('keeps both when the content differs: the old file is untouched, the copy gets the job suffix', async () => {
      const world = await makeWorld([{ rootPath: file }]);
      const suffix = `photo.exodus-${world.job.id.slice(0, 8)}.jpg`;

      preexisting(world.sourceDirName, 'something else entirely');
      await runUntilIdle(world.job.id, { driver: driver() });

      const dir = destPath(world.sourceDirName, 'C', 'data');

      expect(fs.readdirSync(dir).sort()).toEqual([suffix, 'photo.jpg']);
      expect(fs.readFileSync(path.join(dir, 'photo.jpg'), 'utf8')).toBe(
        'something else entirely',
      );
      expect(mtimeOf(world.sourceDirName, 'C', 'data', 'photo.jpg')).toBe(
        seconds(new Date('2001-01-01T00:00:00Z')),
      );
      expect(sha256(fs.readFileSync(path.join(dir, suffix)))).toBe(
        sha256(content),
      );
      expect((await entriesOf(world.items[file].id))[0]).toMatchObject({
        status: 'verified',
        issueKind: 'kept_both',
        destRelPath: `C/data/${suffix}`,
        sha256: sha256(content),
      });
      expect((await itemRow(world.items[file].id)).status).toBe('verified');
    });

    it('does not duplicate the kept copy when a retry follows a crash before it was recorded', async () => {
      const world = await makeWorld([{ rootPath: file }]);

      preexisting(world.sourceDirName, 'something else entirely');
      await expect(
        runUntilIdle(world.job.id, {
          driver: driver(),
          fault: (point) => {
            if (point === 'entry:before-record') {
              throw new FaultInjectedError(point);
            }
          },
        }),
      ).rejects.toBeInstanceOf(FaultInjectedError);

      await expireLeases(world.job.id);
      await runUntilIdle(world.job.id, {
        driver: driver(),
        skipBackoff: true,
      });

      const names = fs.readdirSync(destPath(world.sourceDirName, 'C', 'data'));

      expect(names).toHaveLength(2);
      expect((await entriesOf(world.items[file].id))[0]).toMatchObject({
        status: 'verified',
        issueKind: 'kept_both',
      });
    });

    it('blocks the item with dest_conflict when a directory is where the file must go', async () => {
      const world = await makeWorld([{ rootPath: file }]);

      fs.mkdirSync(destPath(world.sourceDirName, 'C', 'data', 'photo.jpg'), {
        recursive: true,
      });
      await runUntilIdle(world.job.id, { driver: driver() });

      expect(await itemRow(world.items[file].id)).toMatchObject({
        status: 'blocked',
        attemptCount: 1,
      });
      expect((await entriesOf(world.items[file].id))[0]).toMatchObject({
        status: 'failed',
        issueKind: 'dest_conflict',
      });
      expect(fs.readdirSync(DESTINATION_PATH)).toEqual([world.sourceDirName]);
    });

    it('blocks the item with dest_conflict when a file is where a directory must be created', async () => {
      const world = await makeWorld([{ rootPath: file }]);

      fs.mkdirSync(destPath(world.sourceDirName, 'C'), { recursive: true });
      fs.writeFileSync(destPath(world.sourceDirName, 'C', 'data'), 'a file');
      await runUntilIdle(world.job.id, { driver: driver() });

      expect((await entriesOf(world.items[file].id))[0]).toMatchObject({
        status: 'failed',
        issueKind: 'dest_conflict',
      });
      expect((await itemRow(world.items[file].id)).status).toBe('blocked');
    });
  });

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
