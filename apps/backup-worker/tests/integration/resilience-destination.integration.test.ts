import fsPromises from 'fs/promises';
import { FakeDriver } from '@abbottland/source-access';
import { resumeDestinationJobs } from '../../src/copy/pauses';
import { DestinationUnhealthyError } from '../../src/copy/errors';
import {
  getWatchdog,
  resetWatchdogForTests,
} from '../../src/destination/runtime';
import { DESTINATION_ID, getRequest } from '../jest.integration.setup';
import {
  bytes,
  entryMap,
  itemRow,
  makeWorld,
  runOnce,
  runUntilIdle,
} from './helpers/copy-harness';
import {
  MODIFIED,
  destinationHealth,
  eventCount,
  jobRow,
  leaseOf,
  query,
  sleep,
  until,
  useResilienceWorld,
  validationPasses,
} from './helpers/resilience';

describe('resilience', () => {
  useResilienceWorld();

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
});
