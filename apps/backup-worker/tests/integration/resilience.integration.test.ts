import fs from 'fs';
import fsPromises from 'fs/promises';
import {
  BackupError,
  completeBackupItem,
  createBackupJob,
  failBackupItem,
  getBackupCoverage,
  heartbeatBackupItem,
  recordBackupDestinationValidation,
  releaseBackupItem,
  retryBackupJobItem,
  retryFailedBackupJobItems,
  transitionBackupJob,
} from '@abbottland/homelab-db';
import { FakeDriver } from '@abbottland/source-access';
import { PauseTracker, DESTINATION_KEY } from '../../src/copy/pause-tracker';
import { resumeDestinationJobs } from '../../src/copy/pauses';
import {
  DestinationUnhealthyError,
  FaultInjectedError,
  ShutdownError,
} from '../../src/copy/errors';
import { db } from '../../src/db';
import {
  getWatchdog,
  resetWatchdogForTests,
  runtimePauses,
  workerId,
} from '../../src/destination/runtime';
import {
  DESTINATION_ID,
  DESTINATION_PATH,
  getRequest,
} from '../jest.integration.setup';
import {
  HUMAN,
  bytes,
  cleanupWorld,
  createDestinationRow,
  deleteDestinationRow,
  destPath,
  entryMap,
  expireLeases,
  itemRow,
  jobStatus,
  makeAvailable,
  makeWorld,
  resetDestination,
  runOnce,
  runUntilIdle,
  snapshot,
} from './helpers/copy-harness';

const MODIFIED = new Date('2018-03-04T05:06:07Z');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const query = async <T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> => (await db.$client.query(sql, params)).rows as T[];

const eventCount = async (eventType: string, jobId: string): Promise<number> =>
  (
    await query<{ n: number }>(
      'select count(*)::int as n from audit_events where event_type = $1 and backup_job_id = $2',
      [eventType, jobId],
    )
  )[0].n;

const jobRow = async (id: string) =>
  (
    await query<{ status: string; stalledReason: string | null }>(
      'select status, stalled_reason as "stalledReason" from backup_jobs where id = $1',
      [id],
    )
  )[0];

const destinationHealth = async (): Promise<string> =>
  (
    await query<{ health: string }>(
      'select health from backup_destinations where id = $1',
      [DESTINATION_ID],
    )
  )[0].health;

const leaseOf = async (itemId: string): Promise<number> =>
  new Date(
    (
      await query<{ at: Date }>(
        'select lease_expires_at as at from backup_job_items where id = $1',
        [itemId],
      )
    )[0].at,
  ).getTime();

const until = async (check: () => Promise<boolean> | boolean, ms = 5000) => {
  const deadline = Date.now() + ms;

  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(20);
  }
  throw new Error('timed out waiting for a condition');
};

/** The destination check that passes, as a worker's validation would record it. */
const validationPasses = () =>
  recordBackupDestinationValidation(db, DESTINATION_ID, {
    workerId,
    validation: { ok: true, mountVerified: false, checks: [], findings: {} },
  });

describe('resilience', () => {
  beforeAll(createDestinationRow);

  afterAll(async () => {
    await cleanupWorld();
    await deleteDestinationRow();
  });

  afterEach(async () => {
    await cleanupWorld();
    resetDestination();
    resetWatchdogForTests();
    runtimePauses.reset(DESTINATION_KEY);
    await query("update backup_destinations set health = 'unknown'");
  });

  describe('a source that stops sending', () => {
    const file = 'C:\\data\\slow.bin';

    it('fails the attempt with a transient read_failed after the stall timeout, leaving no staging file', async () => {
      const driver = new FakeDriver()
        .addFile(file, bytes(300_000), { modifiedAt: MODIFIED })
        .fault(file, { kind: 'hang', afterBytes: 70_000, times: 1 });
      const world = await makeWorld([{ rootPath: file }]);

      const results = await runUntilIdle(world.job.id, {
        driver,
        stallTimeoutMs: 150,
      });

      expect(results).toEqual(['settled', 'idle:retry_backoff']);
      const [entry] = Object.values(await entryMap(world.items[file].id));

      expect(entry).toMatchObject({
        status: 'failed',
        issueKind: 'read_failed',
      });
      expect(await itemRow(world.items[file].id)).toMatchObject({
        status: 'queued',
        attemptCount: 1,
      });
      expect(fs.readdirSync(DESTINATION_PATH)).toEqual([world.sourceDirName]);
      expect(
        fs.existsSync(destPath(world.sourceDirName, '.exodus-staging')),
      ).toBe(false);

      // Nothing was paused: a stalled read is the item's attempt, not an outage.
      expect(await jobRow(world.job.id)).toMatchObject({
        status: 'running',
        stalledReason: null,
      });
    });
  });

  describe('a source that is unreachable', () => {
    const file = 'C:\\data\\photo.jpg';
    const content = bytes(80_000);
    const sourceFile = () =>
      new FakeDriver().addFile(file, content, { modifiedAt: MODIFIED });

    it('pauses the job without spending an attempt, with one stalled event, and resumes when the source answers', async () => {
      const clock = { now: Date.now() };
      const pauses = new PauseTracker(() => clock.now);
      const driver = sourceFile();
      const world = await makeWorld([{ rootPath: file }]);
      const options = { driver, pauses };

      driver.unreachable = true;
      expect(await runOnce(options)).toEqual({
        kind: 'backoff',
        reason: 'source_unreachable',
      });
      expect(await itemRow(world.items[file].id)).toMatchObject({
        status: 'queued',
        attemptCount: 0,
      });
      expect(await jobRow(world.job.id)).toMatchObject({
        status: 'running',
        stalledReason: 'source_unreachable',
      });

      // Paused: claims hand out nothing, spend nothing, add no event.
      for (let i = 0; i < 3; i++) {
        expect(await runOnce(options)).toMatchObject({
          kind: 'idle',
          reason: 'source_unreachable',
        });
      }
      // Its wait is over and it still does not answer: still paused, waits longer.
      clock.now += 31_000;
      expect(await runOnce(options)).toMatchObject({
        kind: 'idle',
        reason: 'source_unreachable',
      });
      expect(await itemRow(world.items[file].id)).toMatchObject({
        status: 'queued',
        attemptCount: 0,
      });
      expect(await eventCount('backup_job.stalled', world.job.id)).toBe(1);
      expect(await eventCount('backup_job.resumed', world.job.id)).toBe(0);

      // The source comes back; the longer wait (60 s) has to pass first.
      driver.unreachable = false;
      clock.now += 30_000;
      expect(await runOnce(options)).toMatchObject({ kind: 'idle' });

      clock.now += 31_000;
      expect(await runOnce(options)).toMatchObject({ kind: 'settled' });
      expect(await eventCount('backup_job.resumed', world.job.id)).toBe(1);
      expect(await eventCount('backup_job.stalled', world.job.id)).toBe(1);
      expect(await itemRow(world.items[file].id)).toMatchObject({
        status: 'verified',
        attemptCount: 1,
      });
      expect(
        fs.readFileSync(
          destPath(world.sourceDirName, 'C', 'data', 'photo.jpg'),
        ),
      ).toEqual(content);
    });

    it('counts the attempt and does not pause when the source reports an outage but answers a connection test', async () => {
      const driver = sourceFile().fault(file, {
        kind: 'unreachable',
        times: 1,
      });
      const world = await makeWorld([{ rootPath: file }]);

      expect(await runOnce({ driver })).toEqual({
        kind: 'backoff',
        reason: 'error',
      });

      const row = await itemRow(world.items[file].id);

      expect(row).toMatchObject({ status: 'queued', attemptCount: 1 });
      expect(row.lastError).toContain('answers a connection test');
      expect(await jobRow(world.job.id)).toMatchObject({ stalledReason: null });
      expect(await eventCount('backup_job.stalled', world.job.id)).toBe(0);
    });
  });

  describe('a destination that stops answering', () => {
    const file = 'C:\\data\\photo.jpg';

    it('stops the heartbeats, marks the destination unhealthy, fails /readyz, and recovers once the call returns', async () => {
      resetWatchdogForTests(200);
      const driver = new FakeDriver().addFile(file, bytes(80_000), {
        modifiedAt: MODIFIED,
      });
      const world = await makeWorld([{ rootPath: file }]);
      const itemId = world.items[file].id;

      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const hanging = {
        ...fsPromises,
        // The first write into the staging area never returns, like a hard mount.
        open: async (target: string, flags: string) => {
          if (String(target).includes('.exodus-staging') && flags === 'w') {
            await gate;
          }

          return fsPromises.open(target, flags);
        },
      };

      const running = runOnce({
        driver,
        heartbeatMs: 40,
        fsDeps: {
          fs: hanging as never,
          run: (operation, fn) => getWatchdog().run(operation, fn),
        },
      });

      await until(() => getWatchdog().state().stalled);
      await getRequest()
        .get('/readyz')
        .expect(503)
        .expect((res) => {
          expect(res.body.message).toContain('destination call stalled');
        });

      await until(async () => (await destinationHealth()) === 'unhealthy');
      await until(
        async () =>
          (await jobRow(world.job.id)).stalledReason ===
          'destination_unhealthy',
      );

      // No heartbeat any more: the lease no longer moves.
      await sleep(100);
      const lease = await leaseOf(itemId);

      await sleep(250);
      expect(await leaseOf(itemId)).toBe(lease);

      expect(
        (
          await query<{ n: number }>(
            "select count(*)::int as n from audit_events where event_type = 'backup_destination.unhealthy' and destination_id = $1",
            [DESTINATION_ID],
          )
        )[0].n,
      ).toBe(1);
      expect(await eventCount('backup_job.stalled', world.job.id)).toBe(1);

      // The call returns (the pod would have been restarted by now): the item
      // is handed back untouched and the probes recover.
      release();
      expect(await running).toEqual({
        kind: 'backoff',
        reason: 'destination_unhealthy',
      });
      expect(await itemRow(itemId)).toMatchObject({
        status: 'queued',
        attemptCount: 0,
      });
      await getRequest().get('/readyz').expect(200);

      // A passing validation lets the job run again.
      await validationPasses();
      await resumeDestinationJobs();
      expect(await jobRow(world.job.id)).toMatchObject({ stalledReason: null });
      await runUntilIdle(world.job.id, { driver });
      expect(await itemRow(itemId)).toMatchObject({
        status: 'verified',
        attemptCount: 1,
      });
    });

    const failing = (code: string, onOperation: 'open' | 'link' = 'open') => ({
      fs: {
        ...fsPromises,
        [onOperation]: async (...args: unknown[]) => {
          const target = String(onOperation === 'link' ? args[1] : args[0]);

          if (
            onOperation === 'link' ||
            (target.includes('.exodus-staging') && args[1] === 'w')
          ) {
            throw Object.assign(new Error(code), { code });
          }

          return (fsPromises.open as (...a: unknown[]) => unknown)(...args);
        },
      } as never,
      run: <T>(_operation: string, fn: () => Promise<T>) => fn(),
    });

    it.each(['EIO', 'ESTALE', 'ENOSPC', 'EACCES'])(
      'releases the item with the attempt refunded and pauses the job on %s in the staging area',
      async (code) => {
        const driver = new FakeDriver().addFile(file, bytes(1000), {
          modifiedAt: MODIFIED,
        });
        const world = await makeWorld([{ rootPath: file }]);

        expect(await runOnce({ driver, fsDeps: failing(code) })).toEqual({
          kind: 'backoff',
          reason: 'destination_unhealthy',
        });
        expect(await itemRow(world.items[file].id)).toMatchObject({
          status: 'queued',
          attemptCount: 0,
        });
        expect(await destinationHealth()).toBe('unhealthy');
        expect(await jobRow(world.job.id)).toMatchObject({
          stalledReason: 'destination_unhealthy',
        });
        expect(await entryMap(world.items[file].id)).toMatchObject({
          '': { status: 'pending' },
        });

        // Paused: nothing is claimed and nothing is spent.
        expect(await runOnce({ driver })).toMatchObject({
          kind: 'idle',
          reason: 'destination_unhealthy',
        });

        await validationPasses();
        await resumeDestinationJobs();
        await runUntilIdle(world.job.id, { driver });

        expect(await itemRow(world.items[file].id)).toMatchObject({
          status: 'verified',
          attemptCount: 1,
        });
      },
    );

    it('pauses the job when the mount is gone before the item starts', async () => {
      const driver = new FakeDriver().addFile(file, bytes(1000));
      const world = await makeWorld([{ rootPath: file }]);

      expect(
        await runOnce({
          driver,
          preflight: async () => {
            throw new DestinationUnhealthyError('mount', 'ENOTCONN', 'gone');
          },
        }),
      ).toEqual({ kind: 'backoff', reason: 'destination_unhealthy' });
      expect(await itemRow(world.items[file].id)).toMatchObject({
        status: 'queued',
        attemptCount: 0,
      });
      expect(await jobRow(world.job.id)).toMatchObject({
        stalledReason: 'destination_unhealthy',
      });
    });

    it('records EACCES under the source folder as a write_failed entry and pauses nothing', async () => {
      const driver = new FakeDriver().addFile(file, bytes(1000), {
        modifiedAt: MODIFIED,
      });
      const world = await makeWorld([{ rootPath: file }]);

      const results = await runUntilIdle(world.job.id, {
        driver,
        fsDeps: failing('EACCES', 'link'),
      });

      expect(results).toEqual(['settled', 'idle:retry_backoff']);
      expect(await entryMap(world.items[file].id)).toMatchObject({
        '': { status: 'failed', issueKind: 'write_failed' },
      });
      expect(await itemRow(world.items[file].id)).toMatchObject({
        status: 'queued',
        attemptCount: 1,
      });
      expect(await destinationHealth()).toBe('unknown');
      expect(await jobRow(world.job.id)).toMatchObject({ stalledReason: null });
    });
  });

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

  describe('leases that run out', () => {
    it('are reported as one event for the job, with the destination and the item ids', async () => {
      const files = ['C:\\data\\a.txt', 'C:\\data\\b.txt', 'C:\\data\\c.txt'];
      const driver = new FakeDriver();

      for (const file of files) driver.addFile(file, 'x');
      const world = await makeWorld(files.map((rootPath) => ({ rootPath })));

      for (let i = 0; i < files.length; i++) {
        await expect(
          runOnce({
            driver,
            fault: (point) => {
              if (point === 'item:start') throw new FaultInjectedError(point);
            },
          }),
        ).rejects.toBeInstanceOf(FaultInjectedError);
      }
      await expireLeases(world.job.id);
      await makeAvailable(world.job.id);
      await runUntilIdle(world.job.id, { driver, skipBackoff: true });

      const events = await query<{
        details: { count: number; failed: number; itemIds: string[] };
        destinationId: string;
        sourceId: string;
      }>(
        `select details, destination_id as "destinationId", source_id as "sourceId" from audit_events where event_type = 'backup_job_items.lease_expired' and backup_job_id = $1`,
        [world.job.id],
      );

      expect(events).toHaveLength(1);
      expect(events[0].details.count).toBe(3);
      expect(events[0].details.failed).toBe(0);
      expect(events[0].details.itemIds.sort()).toEqual(
        files.map((file) => world.items[file].id).sort(),
      );
      expect(events[0].destinationId).toBe(DESTINATION_ID);
      expect(events[0].sourceId).toBe(world.sourceId);
      expect(await jobStatus(world.job.id)).toBe('completed');
    });
  });

  describe('BACKUP_PARALLELISM above 1', () => {
    const root = 'C:\\data\\tree';
    const tree = () => {
      const driver = new FakeDriver();

      for (let i = 0; i < 40; i++) {
        driver.addFile(
          `${root}\\d${i % 4}\\file-${i}.bin`,
          bytes(150_000 + i, i + 1),
          { modifiedAt: new Date(Date.UTC(2015, 0, 1 + i)) },
        );
      }

      return driver;
    };

    it('copies the same tree as one file at a time, with several reads at once but never more than the limit', async () => {
      const sequential = await makeWorld(
        [{ rootPath: root, kind: 'directory' }],
        'sequential',
      );

      await runUntilIdle(sequential.job.id, {
        driver: tree(),
        parallelism: 1,
      });
      const expected = snapshot(destPath('sequential', 'C', 'data', 'tree'));

      expect(
        Object.keys(expected).filter((k) => k.endsWith('.bin')),
      ).toHaveLength(40);

      const parallel = await makeWorld(
        [{ rootPath: root, kind: 'directory' }],
        'parallel',
      );
      const driver = tree();

      await runUntilIdle(parallel.job.id, { driver, parallelism: 4 });

      expect(await jobStatus(parallel.job.id)).toBe('completed');
      expect(snapshot(destPath('parallel', 'C', 'data', 'tree'))).toEqual(
        expected,
      );
      expect(driver.maxConcurrentReads).toBeGreaterThan(1);
      expect(driver.maxConcurrentReads).toBeLessThanOrEqual(4);
      expect(fs.existsSync(destPath('parallel', '.exodus-staging'))).toBe(
        false,
      );
    });

    it('stops the entries beside a failing one and still gives the same tree after a kill and a rerun', async () => {
      const baselineWorld = await makeWorld(
        [{ rootPath: root, kind: 'directory' }],
        'baseline',
      );
      let points = 0;

      await runUntilIdle(baselineWorld.job.id, {
        driver: tree(),
        parallelism: 2,
        fault: () => {
          points += 1;
        },
      });
      const expected = snapshot(destPath('baseline', 'C', 'data', 'tree'));

      for (const share of [0.15, 0.5, 0.85]) {
        const kill = Math.floor(points * share);
        const world = await makeWorld(
          [{ rootPath: root, kind: 'directory' }],
          `killed-${kill}`,
        );
        let hits = 0;

        await runUntilIdle(world.job.id, {
          driver: tree(),
          parallelism: 2,
          fault: (point) => {
            hits += 1;
            if (hits === kill) throw new FaultInjectedError(point);
          },
        }).catch((err) => {
          if (!(err instanceof FaultInjectedError)) throw err;
        });

        await expireLeases(world.job.id);
        await runUntilIdle(world.job.id, {
          driver: tree(),
          parallelism: 2,
          skipBackoff: true,
        });

        expect(await jobStatus(world.job.id)).toBe('completed');
        expect(
          snapshot(destPath(`killed-${kill}`, 'C', 'data', 'tree')),
        ).toEqual(expected);
        expect(
          fs.existsSync(destPath(`killed-${kill}`, '.exodus-staging')),
        ).toBe(false);
      }
    });
  });
});
