import { recordBackupDestinationValidation } from '@abbottland/homelab-db';
import { DESTINATION_KEY } from '../../../src/copy/pause-tracker';
import { db } from '../../../src/db';
import {
  resetWatchdogForTests,
  runtimePauses,
  workerId,
} from '../../../src/destination/runtime';
import { DESTINATION_ID } from '../../jest.integration.setup';
import {
  cleanupWorld,
  createDestinationRow,
  deleteDestinationRow,
  resetDestination,
} from './copy-harness';

export const MODIFIED = new Date('2018-03-04T05:06:07Z');
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const query = async <T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> => (await db.$client.query(sql, params)).rows as T[];

export const eventCount = async (
  eventType: string,
  jobId: string,
): Promise<number> =>
  (
    await query<{ n: number }>(
      'select count(*)::int as n from audit_events where event_type = $1 and backup_job_id = $2',
      [eventType, jobId],
    )
  )[0].n;

export const jobRow = async (id: string) =>
  (
    await query<{ status: string; stalledReason: string | null }>(
      'select status, stalled_reason as "stalledReason" from backup_jobs where id = $1',
      [id],
    )
  )[0];

export const destinationHealth = async (): Promise<string> =>
  (
    await query<{ health: string }>(
      'select health from backup_destinations where id = $1',
      [DESTINATION_ID],
    )
  )[0].health;

export const leaseOf = async (itemId: string): Promise<number> =>
  new Date(
    (
      await query<{ at: Date }>(
        'select lease_expires_at as at from backup_job_items where id = $1',
        [itemId],
      )
    )[0].at,
  ).getTime();

export const until = async (
  check: () => Promise<boolean> | boolean,
  ms = 5000,
) => {
  const deadline = Date.now() + ms;

  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(20);
  }
  throw new Error('timed out waiting for a condition');
};

/** The destination check that passes, as a worker's validation would record it. */
export const validationPasses = () =>
  recordBackupDestinationValidation(db, DESTINATION_ID, {
    workerId,
    validation: { ok: true, mountVerified: false, checks: [], findings: {} },
  });

export const useResilienceWorld = (): void => {
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
};
