import { runMigrationsWithLock } from '@abbottland/video-db';
import { config } from '../../src/config';

describe('runMigrationsWithLock', () => {
  it('is safe to call concurrently against the same database', async () => {
    // Migrations are already applied by jest.integration.setup.ts; these
    // calls are no-ops, but they still exercise the real advisory-lock
    // acquire/release path. Without the lock, drizzle's migrate() has no
    // concurrency protection of its own.
    await expect(
      Promise.all([
        runMigrationsWithLock(config.postgres),
        runMigrationsWithLock(config.postgres),
        runMigrationsWithLock(config.postgres),
      ]),
    ).resolves.toBeDefined();
  });
});
