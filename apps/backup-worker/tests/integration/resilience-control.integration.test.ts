import fs from 'fs';
import {
  BackupError,
  completeBackupItem,
  createBackupJob,
  failBackupItem,
  getBackupCoverage,
  heartbeatBackupItem,
  releaseBackupItem,
  retryBackupJobItem,
  retryFailedBackupJobItems,
  transitionBackupJob,
} from '@abbottland/homelab-db';
import { FakeDriver } from '@abbottland/source-access';
import { ShutdownError } from '../../src/copy/errors';
import { db } from '../../src/db';
import { DESTINATION_ID } from '../jest.integration.setup';
import {
  HUMAN,
  bytes,
  destPath,
  entryMap,
  itemRow,
  jobStatus,
  makeWorld,
  runOnce,
  runUntilIdle,
  snapshot,
} from './helpers/copy-harness';
import {
  MODIFIED,
  jobRow,
  query,
  sleep,
  useResilienceWorld,
} from './helpers/resilience';

describe('resilience', () => {
  useResilienceWorld();

  describe('a worker asked to stop', () => {
    const root = 'C:\\data\\proj';
    const driver = () =>
      new FakeDriver()
        .addFile(`${root}\\a.txt`, 'alpha', { modifiedAt: MODIFIED })
        .addFile(`${root}\\b.bin`, bytes(200_000, 3), {
          modifiedAt: new Date('2012-02-03T04:05:06Z'),
        })
        .addFile(`${root}\\c.txt`, 'gamma', {
          modifiedAt: new Date('2013-03-04T05:06:07Z'),
        });

    it('deletes the staging file and releases the item with the attempt refunded, keeping verified entries, and a rerun gives the same tree', async () => {
      const baseline = await makeWorld(
        [{ rootPath: root, kind: 'directory' }],
        'baseline',
      );

      await runUntilIdle(baseline.job.id, { driver: driver() });
      const expected = snapshot(destPath('baseline', 'C', 'data', 'proj'));

      expect(Object.keys(expected)).toContain('b.bin');

      const world = await makeWorld(
        [{ rootPath: root, kind: 'directory' }],
        'stopped',
      );
      const itemId = world.items[root].id;
      const shutdown = new AbortController();

      const result = await runOnce({
        driver: driver(),
        shutdownSignal: shutdown.signal,
        fault: (point, detail) => {
          if (point === 'stage:chunk' && detail === 'b.bin') {
            shutdown.abort(new ShutdownError());
          }
        },
      });

      expect(result).toEqual({ kind: 'backoff', reason: 'shutdown' });
      expect(await itemRow(itemId)).toMatchObject({
        status: 'queued',
        attemptCount: 0,
      });
      expect((await itemRow(itemId)).lastError).toContain('released by');
      expect(await entryMap(itemId)).toMatchObject({
        'a.txt': { status: 'verified' },
        'b.bin': { status: 'pending' },
      });
      expect(
        fs.existsSync(destPath('stopped', 'C', 'data', 'proj', 'a.txt')),
      ).toBe(true);
      expect(
        fs.existsSync(destPath('stopped', 'C', 'data', 'proj', 'b.bin')),
      ).toBe(false);
      expect(fs.existsSync(destPath('stopped', '.exodus-staging'))).toBe(false);
      // A job that is released and not finished is not paused.
      expect(await jobRow(world.job.id)).toMatchObject({ stalledReason: null });

      await runUntilIdle(world.job.id, { driver: driver() });

      expect(await itemRow(itemId)).toMatchObject({
        status: 'verified',
        attemptCount: 1,
      });
      expect(snapshot(destPath('stopped', 'C', 'data', 'proj'))).toEqual(
        expected,
      );
    });
  });

  describe('a cancelled job', () => {
    const root = 'C:\\data\\proj';

    it('stops the transfer, removes its staging and rejects every late call of the worker', async () => {
      const driver = new FakeDriver()
        .addFile(`${root}\\a.txt`, 'alpha', { modifiedAt: MODIFIED })
        .addFile(`${root}\\b.bin`, bytes(200_000, 3), { modifiedAt: MODIFIED });
      const world = await makeWorld([{ rootPath: root, kind: 'directory' }]);
      const itemId = world.items[root].id;
      let token = '';
      let cancelled = false;

      const result = await runOnce({
        driver,
        heartbeatMs: 30,
        fault: async (point, detail) => {
          if (point === 'stage:chunk' && detail === 'b.bin' && !cancelled) {
            cancelled = true;
            token = (
              await query<{ token: string }>(
                'select claim_token as token from backup_job_items where id = $1',
                [itemId],
              )
            )[0].token;
            await transitionBackupJob(db, world.job.id, 'cancelled', HUMAN);
            // Give the heartbeat time to find the lease gone.
            await sleep(200);
          }
        },
      });

      expect(result).toEqual({ kind: 'backoff', reason: 'claim_lost' });
      expect(await jobStatus(world.job.id)).toBe('cancelled');
      expect(await itemRow(itemId)).toMatchObject({ status: 'queued' });
      expect(await entryMap(itemId)).toMatchObject({
        'a.txt': { status: 'verified' },
        'b.bin': { status: 'pending' },
      });
      expect(
        fs.existsSync(destPath(world.sourceDirName, '.exodus-staging')),
      ).toBe(false);
      expect(
        fs.existsSync(
          destPath(world.sourceDirName, 'C', 'data', 'proj', 'b.bin'),
        ),
      ).toBe(false);

      const late = { claimToken: token };

      for (const call of [
        () => heartbeatBackupItem(db, itemId, { ...late, leaseSeconds: 300 }),
        () => completeBackupItem(db, itemId, late),
        () =>
          failBackupItem(db, itemId, {
            ...late,
            error: 'x',
            kind: 'transient',
          }),
        () => releaseBackupItem(db, itemId, late),
      ]) {
        await expect(call()).rejects.toBeInstanceOf(BackupError);
      }
      expect(await itemRow(itemId)).toMatchObject({ status: 'queued' });
    });
  });

  describe('human retry', () => {
    const file = 'C:\\data\\bad.bin';
    const broken = () =>
      new FakeDriver()
        .addFile(file, bytes(5000), { modifiedAt: MODIFIED })
        .fault(file, { kind: 'short', bytes: 100 });

    it('grants exactly one more attempt, and only while the job is active', async () => {
      const driver = broken();
      const world = await makeWorld([{ rootPath: file }], undefined, 1);
      const itemId = world.items[file].id;

      expect(await runOnce({ driver })).toMatchObject({ kind: 'settled' });
      expect(await itemRow(itemId)).toMatchObject({
        status: 'failed',
        attemptCount: 1,
        maxAttempts: 1,
      });
      expect(await jobRow(world.job.id)).toMatchObject({ status: 'running' });

      await retryBackupJobItem(db, itemId, HUMAN);
      expect(await itemRow(itemId)).toMatchObject({
        status: 'queued',
        attemptCount: 1,
        maxAttempts: 2,
      });

      expect(await runOnce({ driver })).toMatchObject({ kind: 'settled' });
      expect(await itemRow(itemId)).toMatchObject({
        status: 'failed',
        attemptCount: 2,
      });
      // Nothing more is handed out: the job ends with issues.
      expect(await runOnce({ driver })).toMatchObject({
        kind: 'idle',
        reason: 'queue_empty',
      });
      expect(await jobStatus(world.job.id)).toBe('completed_with_issues');

      await expect(retryBackupJobItem(db, itemId, HUMAN)).rejects.toMatchObject(
        {
          code: 'conflict',
        },
      );
      await expect(
        retryFailedBackupJobItems(db, world.job.id, HUMAN),
      ).rejects.toMatchObject({ code: 'conflict' });
      expect(await itemRow(itemId)).toMatchObject({
        status: 'failed',
        attemptCount: 2,
        maxAttempts: 2,
      });
    });

    it('retry-failed requeues every failed item of an active job once', async () => {
      const other = 'C:\\data\\worse.bin';
      const driver = broken()
        .addFile(other, bytes(5000), { modifiedAt: MODIFIED })
        .fault(other, { kind: 'short', bytes: 100 });
      const world = await makeWorld(
        [{ rootPath: file }, { rootPath: other }],
        undefined,
        1,
      );

      await runOnce({ driver });
      await runOnce({ driver });

      const requeued = await retryFailedBackupJobItems(db, world.job.id, HUMAN);

      expect(requeued).toHaveLength(2);
      expect(await runOnce({ driver })).toMatchObject({ kind: 'settled' });
      expect(await runOnce({ driver })).toMatchObject({ kind: 'settled' });
      expect(await itemRow(world.items[file].id)).toMatchObject({
        status: 'failed',
        attemptCount: 2,
      });
      expect(await itemRow(world.items[other].id)).toMatchObject({
        status: 'failed',
        attemptCount: 2,
      });
    });
  });

  describe('a rerun of the unresolved items', () => {
    const root = 'C:\\data\\proj';

    it('copies only what is missing, leaves verified files alone and ends covered', async () => {
      const driver = new FakeDriver()
        .addFile(`${root}\\good.txt`, 'fine', { modifiedAt: MODIFIED })
        .addFile(`${root}\\bad.bin`, bytes(90_000), { modifiedAt: MODIFIED })
        .fault(`${root}\\bad.bin`, { kind: 'error', afterBytes: 1000 });
      const world = await makeWorld(
        [{ rootPath: root, kind: 'directory' }],
        undefined,
        1,
      );
      const goodPath = destPath(
        world.sourceDirName,
        'C',
        'data',
        'proj',
        'good.txt',
      );

      await runUntilIdle(world.job.id, { driver });

      expect(await jobStatus(world.job.id)).toBe('completed_with_issues');
      const before = fs.statSync(goodPath);

      // What the API's rerun does: a new job from the failed items, planned again.
      driver.clearFaults();
      const [failed] = await query<{
        inventoryItemId: string;
        rootPath: string;
        normalizedRootPath: string;
        destRelPath: string;
      }>(
        `select inventory_item_id as "inventoryItemId", root_path as "rootPath", normalized_root_path as "normalizedRootPath", dest_rel_path as "destRelPath" from backup_job_items where job_id = $1 and status = 'failed'`,
        [world.job.id],
      );
      const rerun = await createBackupJob(
        db,
        {
          sourceId: world.sourceId,
          destinationId: DESTINATION_ID,
          selection: { skipAlreadyCovered: true },
          sourceDirName: world.sourceDirName,
          items: [
            {
              inventoryItemId: failed.inventoryItemId,
              kind: 'directory',
              rootPath: failed.rootPath,
              normalizedRootPath: failed.normalizedRootPath,
              destRelPath: failed.destRelPath,
              status: 'queued',
            },
          ],
        },
        HUMAN,
      );

      await runUntilIdle(rerun.id, { driver });

      expect(await jobStatus(rerun.id)).toBe('completed');
      const after = fs.statSync(goodPath);

      expect(after.ino).toBe(before.ino);
      expect(after.ctimeMs).toBe(before.ctimeMs);
      expect(
        fs.readFileSync(
          destPath(world.sourceDirName, 'C', 'data', 'proj', 'bad.bin'),
        ),
      ).toEqual(bytes(90_000));
      expect(
        fs.existsSync(destPath(world.sourceDirName, '.exodus-staging')),
      ).toBe(false);

      const report = await getBackupCoverage(db, {
        sourceId: world.sourceId,
        destinationId: DESTINATION_ID,
      });

      expect(report.items.find((item) => item.rootPath === root)?.bucket).toBe(
        'covered',
      );
      expect(report.allAccounted).toBe(true);
    });
  });
});
