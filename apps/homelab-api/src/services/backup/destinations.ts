import {
  createBackupDestination as createRow,
  getBackupDestination,
  listBackupDestinations as listRows,
  requestBackupDestinationValidation,
  setBackupDestinationEnabled,
  updateBackupDestination as updateRow,
  BackupError,
  type Actor,
  type BackupDestination,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import type {
  CreateBackupDestinationBody,
  UpdateBackupDestinationBody,
} from '../../schemas/backup/destinations';

/** The worker polls every few seconds; a gap this long means none is running. */
export const WORKER_STALE_AFTER_MS = 2 * 60 * 1000;

export type BackupDestinationView = BackupDestination & {
  /** True when no worker has polled recently (or ever): validation will not run. */
  workerStale: boolean;
};

export const toDestinationView = (
  row: BackupDestination,
  now = Date.now(),
): BackupDestinationView => ({
  ...row,
  workerStale:
    !row.workerSeenAt ||
    now - row.workerSeenAt.getTime() > WORKER_STALE_AFTER_MS,
});

export const requireDestination = async (
  id: string,
): Promise<BackupDestination> => {
  const row = await getBackupDestination(db, id);
  if (!row) throw new BackupError('not_found', 'backup destination not found');

  return row;
};

export async function createDestination(
  body: CreateBackupDestinationBody,
  actor: Actor,
): Promise<BackupDestinationView> {
  return toDestinationView(await createRow(db, body, actor));
}

export async function listDestinations(): Promise<BackupDestinationView[]> {
  return (await listRows(db)).map((row) => toDestinationView(row));
}

export async function getDestination(
  id: string,
): Promise<BackupDestinationView> {
  return toDestinationView(await requireDestination(id));
}

export async function updateDestination(
  id: string,
  body: UpdateBackupDestinationBody,
  actor: Actor,
): Promise<BackupDestinationView> {
  return toDestinationView(await updateRow(db, id, body, actor));
}

export async function setDestinationEnabled(
  id: string,
  enabled: boolean,
  actor: Actor,
): Promise<BackupDestinationView> {
  return toDestinationView(
    await setBackupDestinationEnabled(db, id, enabled, actor),
  );
}

/** Only records the request; the worker validates and clears it. */
export async function requestValidation(
  id: string,
): Promise<BackupDestinationView> {
  return toDestinationView(await requestBackupDestinationValidation(db, id));
}
