import fs from 'fs';
import path from 'path';
import { requestBackupDestinationValidation } from '@abbottland/homelab-db';
import { db } from '../../src/db';
import { startPollLoop, stopPollLoop } from '../../src/worker/poll-loop';
import { DESTINATION_ID, DESTINATION_PATH } from '../jest.integration.setup';

type Row = {
  health: string;
  last_validation: {
    ok: boolean;
    mountVerified: boolean;
    rootEntries: string[];
    checks: { name: string; ok: boolean }[];
  } | null;
  validation_requested_at: Date | null;
  worker_seen_at: Date | null;
  last_validated_at: Date | null;
};

const readRow = async (): Promise<Row> => {
  const { rows } = await db.$client.query(
    'select health, last_validation, validation_requested_at, worker_seen_at, last_validated_at from backup_destinations where id = $1',
    [DESTINATION_ID],
  );

  return rows[0];
};

const waitFor = async (
  predicate: (row: Row) => boolean,
  timeoutMs = 10_000,
): Promise<Row> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const row = await readRow();
    if (predicate(row)) return row;
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting; last row: ${JSON.stringify(row)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

const auditCount = async (): Promise<number> => {
  const { rows } = await db.$client.query(
    "select count(*)::int as n from audit_events where destination_id = $1 and event_type = 'backup_destination.validated'",
    [DESTINATION_ID],
  );

  return rows[0].n;
};

describe('destination validation round trip', () => {
  beforeAll(async () => {
    await db.$client.query(
      `insert into backup_destinations (id, name, connection_type, settings)
       values ($1, $2, 'nfs', $3)`,
      [
        DESTINATION_ID,
        `worker-test-${DESTINATION_ID}`,
        JSON.stringify({ server: '192.0.2.10', exportPath: '/volume1/Test' }),
      ],
    );
    fs.mkdirSync(path.join(DESTINATION_PATH, 'unrelated-folder'));
    fs.writeFileSync(path.join(DESTINATION_PATH, 'junk.txt'), 'x');
  });

  afterAll(async () => {
    await stopPollLoop();
    await db.$client.query(
      'delete from audit_events where destination_id = $1',
      [DESTINATION_ID],
    );
    await db.$client.query('delete from backup_destinations where id = $1', [
      DESTINATION_ID,
    ]);
  });

  it('validates at startup and reports the worker as seen', async () => {
    startPollLoop();

    const row = await waitFor((r) => r.last_validation !== null);

    expect(row.health).toBe('ok');
    expect(row.last_validation).toMatchObject({
      ok: true,
      mountVerified: false,
      rootEntries: ['junk.txt', 'unrelated-folder'],
    });
    expect(row.worker_seen_at).not.toBeNull();
    expect(row.last_validated_at).not.toBeNull();
    expect(row.validation_requested_at).toBeNull();
  });

  it('answers a validation request: clears it and rewrites last_validation', async () => {
    const auditBefore = await auditCount();
    fs.mkdirSync(path.join(DESTINATION_PATH, 'alpha-centauri'));

    // What POST /backup-destinations/:id/validate calls.
    await requestBackupDestinationValidation(db, DESTINATION_ID);
    expect((await readRow()).validation_requested_at).not.toBeNull();

    const row = await waitFor(
      (r) =>
        r.validation_requested_at === null &&
        !!r.last_validation?.rootEntries.includes('alpha-centauri'),
    );

    expect(row.health).toBe('ok');
    expect(row.last_validation?.rootEntries).toEqual([
      'alpha-centauri',
      'junk.txt',
      'unrelated-folder',
    ]);
    expect(await auditCount()).toBe(auditBefore + 1);
  });

  it('keeps updating worker_seen_at while idle', async () => {
    const first = (await readRow()).worker_seen_at as Date;
    const row = await waitFor((r) => (r.worker_seen_at as Date) > first);

    expect(row.worker_seen_at).not.toEqual(first);
  });

  it('leaves nothing but the unrelated entries and its own folders under the root', async () => {
    await stopPollLoop();

    expect(fs.readdirSync(DESTINATION_PATH).sort()).toEqual([
      'alpha-centauri',
      'junk.txt',
      'unrelated-folder',
    ]);
  });
});
