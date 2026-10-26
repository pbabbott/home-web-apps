import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  closeDb,
  runMigrationsWithLock,
  sourceConnections,
  sources,
  type NewSourceConnection,
} from '@abbottland/homelab-db';
import { config, initConfig } from '../config';
import { db } from '../db';
import {
  RemoteDatabaseTargetError,
  assertDatabaseIsLocal,
  initLocalDb,
} from './local-only';

/**
 * LOCAL ONLY: never touches a remote database (`initLocalDb` throws if
 * POSTGRES_HOST is not this machine).
 *
 * Keeps local SMB credentials across `local:reset-from-remote`, which wipes the local
 * Postgres volume. `seed:remote` never copies `source_connections` (prod's
 * credentials are not exposed by the API), so `save` writes the local rows to
 * a gitignored file before the wipe and `restore` re-inserts them afterwards.
 * Rows are keyed by source name because source ids differ per environment.
 */
const BACKUP_FILE = resolve(__dirname, '../../.local-connections.json');

type SavedConnection = Omit<NewSourceConnection, 'sourceId'> & {
  sourceName: string;
};

async function save() {
  const [rows, allSources] = await Promise.all([
    db.select().from(sourceConnections),
    db.select({ id: sources.id, name: sources.name }).from(sources),
  ]);
  const nameById = new Map(allSources.map((s) => [s.id, s.name]));

  const saved: SavedConnection[] = rows.flatMap(
    ({ sourceId, ...connection }) => {
      const sourceName = nameById.get(sourceId);
      return sourceName ? [{ ...connection, sourceName }] : [];
    },
  );

  writeFileSync(BACKUP_FILE, JSON.stringify(saved, null, 2), { mode: 0o600 });
  console.log(`Saved ${saved.length} local source connection(s).`);
}

async function restore() {
  if (!existsSync(BACKUP_FILE)) {
    console.log('No saved source connections to restore.');
    return;
  }

  const saved: SavedConnection[] = JSON.parse(
    readFileSync(BACKUP_FILE, 'utf8'),
  );
  const allSources = await db
    .select({ id: sources.id, name: sources.name })
    .from(sources);
  const idByName = new Map(allSources.map((s) => [s.name, s.id]));

  let restored = 0;
  for (const { sourceName, ...connection } of saved) {
    const sourceId = idByName.get(sourceName);
    if (!sourceId) {
      console.warn(`  ! no source named "${sourceName}"; connection skipped`);
      continue;
    }

    await db
      .insert(sourceConnections)
      .values({
        ...connection,
        sourceId,
        lastTestedAt: connection.lastTestedAt
          ? new Date(connection.lastTestedAt)
          : null,
        createdAt: connection.createdAt
          ? new Date(connection.createdAt)
          : undefined,
        updatedAt: connection.updatedAt
          ? new Date(connection.updatedAt)
          : undefined,
      })
      .onConflictDoNothing();
    restored += 1;
    console.log(`  + restored connection for ${sourceName}`);
  }

  console.log(`Restored ${restored} source connection(s).`);
}

async function run() {
  const command = process.argv[2];
  if (command !== 'save' && command !== 'restore') {
    throw new Error('Usage: preserve-local-smb-connections.ts <save|restore>');
  }

  dotenv.config();
  await initConfig();

  if (command === 'save') {
    // Nothing to save on a first run: no container or no tables yet.
    try {
      initLocalDb(config.postgres);
      await save();
    } catch (err) {
      if (err instanceof RemoteDatabaseTargetError) throw err;
      console.warn(`Skipping save of source connections: ${String(err)}`);
    }
  } else {
    assertDatabaseIsLocal(config.postgres);
    await runMigrationsWithLock(config.postgres);
    initLocalDb(config.postgres);
    await restore();
  }

  if (db) await closeDb(db);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
