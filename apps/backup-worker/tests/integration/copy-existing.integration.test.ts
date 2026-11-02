import fs from 'fs';
import path from 'path';
import { FakeDriver } from '@abbottland/source-access';
import { FaultInjectedError } from '../../src/copy/errors';
import { DESTINATION_PATH } from '../jest.integration.setup';
import {
  MODIFIED,
  bytes,
  destPath,
  entriesOf,
  expireLeases,
  itemRow,
  makeWorld,
  mtimeOf,
  runUntilIdle,
  seconds,
  sha256,
  useCopyWorld,
} from './helpers/copy-harness';

describe('copy engine', () => {
  useCopyWorld();

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

    it('adopts the file an interrupted attempt placed without reading the source again', async () => {
      const world = await makeWorld([{ rootPath: file }]);

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

      const resumed = driver();

      await expireLeases(world.job.id);
      await runUntilIdle(world.job.id, { driver: resumed, skipBackoff: true });

      expect(resumed.readsStarted).toBe(0);
      expect(
        fs.readdirSync(destPath(world.sourceDirName, 'C', 'data')),
      ).toEqual(['photo.jpg']);
      expect((await entriesOf(world.items[file].id))[0]).toMatchObject({
        status: 'verified',
        issueKind: null,
        sha256: sha256(content),
      });
    });

    it('copies the file as it is now and notes that it changed since the interrupted attempt', async () => {
      const world = await makeWorld([{ rootPath: file }]);
      const later = new Date('2024-06-01T00:00:00Z');
      const newer = Buffer.concat([content, Buffer.from('appended')]);

      await expect(
        runUntilIdle(world.job.id, {
          driver: driver(),
          fault: (point) => {
            if (point === 'entry:after-metadata') {
              throw new FaultInjectedError(point);
            }
          },
        }),
      ).rejects.toBeInstanceOf(FaultInjectedError);

      await expireLeases(world.job.id);
      await runUntilIdle(world.job.id, {
        driver: new FakeDriver().addFile(file, newer, { modifiedAt: later }),
        skipBackoff: true,
      });

      expect(
        sha256(
          fs.readFileSync(
            destPath(world.sourceDirName, 'C', 'data', 'photo.jpg'),
          ),
        ),
      ).toBe(sha256(newer));
      expect(mtimeOf(world.sourceDirName, 'C', 'data', 'photo.jpg')).toBe(
        seconds(later),
      );
      expect((await entriesOf(world.items[file].id))[0]).toMatchObject({
        status: 'verified',
        issueKind: 'source_changed',
        srcModifiedAt: MODIFIED,
        sizeBytes: newer.length,
        message: expect.stringContaining('changed since it was first read'),
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
});
