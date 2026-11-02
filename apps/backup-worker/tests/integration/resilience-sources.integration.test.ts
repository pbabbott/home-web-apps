import fs from 'fs';
import { FakeDriver } from '@abbottland/source-access';
import { PauseTracker } from '../../src/copy/pause-tracker';
import { DESTINATION_PATH } from '../jest.integration.setup';
import {
  bytes,
  destPath,
  entryMap,
  itemRow,
  makeTestRuntime,
  makeWorld,
  runOnce,
  runUntilIdle,
} from './helpers/copy-harness';
import {
  MODIFIED,
  eventCount,
  jobRow,
  useResilienceWorld,
} from './helpers/resilience';

describe('resilience', () => {
  useResilienceWorld();

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
      const options = { driver, runtime: makeTestRuntime({ pauses }) };

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
});
