import fs from 'fs';
import { FakeDriver } from '@abbottland/source-access';
import { FaultInjectedError } from '../../src/copy/errors';
import { DESTINATION_ID } from '../jest.integration.setup';
import {
  bytes,
  destPath,
  expireLeases,
  jobStatus,
  makeAvailable,
  makeWorld,
  runOnce,
  runUntilIdle,
  snapshot,
} from './helpers/copy-harness';
import { query, useResilienceWorld } from './helpers/resilience';

describe('resilience', () => {
  useResilienceWorld();

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
