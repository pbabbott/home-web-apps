import fs from 'fs';
import { FakeDriver } from '@abbottland/source-access';
import { DESTINATION_PATH } from '../jest.integration.setup';
import {
  MODIFIED,
  bytes,
  destPath,
  entriesOf,
  itemRow,
  jobStatus,
  makeAvailable,
  makeWorld,
  mtimeOf,
  runUntilIdle,
  seconds,
  sha256,
  useCopyWorld,
} from './helpers/copy-harness';

describe('copy engine', () => {
  useCopyWorld();

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
});
