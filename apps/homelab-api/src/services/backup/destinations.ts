import {
  createBackupDestination as createRow,
  getBackupDestination,
  listBackupDestinations as listRows,
  requestBackupDestinationValidation,
  setBackupDestinationEnabled,
  updateBackupDestination as updateRow,
  BackupError,
  type Actor,
  type BackupDestinationWithHost,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import type {
  CreateBackupDestinationBody,
  UpdateBackupDestinationBody,
} from '../../schemas/backup/destinations';

/** The worker polls every few seconds; a gap this long means none is running. */
export const WORKER_STALE_AFTER_MS = 2 * 60 * 1000;

export type BackupDestinationView = BackupDestinationWithHost & {
  /** True when no worker has polled recently (or ever): validation will not run. */
  workerStale: boolean;
};

export const toDestinationView = (
  row: BackupDestinationWithHost,
  now = Date.now(),
): BackupDestinationView => ({
  ...row,
  workerStale:
    !row.workerSeenAt ||
    now - row.workerSeenAt.getTime() > WORKER_STALE_AFTER_MS,
});

export const requireDestination = async (
  id: string,
): Promise<BackupDestinationWithHost> => {
  const row = await getBackupDestination(db, id);
  if (!row) throw new BackupError('not_found', 'backup destination not found');

  return row;
};

export async function createDestination(
  body: CreateBackupDestinationBody,
  actor: Actor,
): Promise<BackupDestinationView> {
  const { id } = await createRow(db, body, actor);

  return toDestinationView(await requireDestination(id));
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
  await updateRow(db, id, body, actor);

  return toDestinationView(await requireDestination(id));
}

export async function setDestinationEnabled(
  id: string,
  enabled: boolean,
  actor: Actor,
): Promise<BackupDestinationView> {
  await setBackupDestinationEnabled(db, id, enabled, actor);

  return toDestinationView(await requireDestination(id));
}

/** Only records the request; the worker validates and clears it. */
export async function requestValidation(
  id: string,
): Promise<BackupDestinationView> {
  await requestBackupDestinationValidation(db, id);

  return toDestinationView(await requireDestination(id));
}
