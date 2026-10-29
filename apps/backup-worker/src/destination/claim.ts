import { promises as fsPromises } from 'fs';
import {
  claimBackupDestination,
  releaseBackupDestinationClaim,
  renewBackupDestinationClaim,
  type BackupDestinationWithHost,
  type BackupDestinationClaimFailure,
} from '@abbottland/homelab-db';
import { db } from '../db';
import { config } from '../config';
import { workerId } from '../worker-id';
import { mountedExport, parseProcMounts } from './mounts';

/** How long a claim lasts without being renewed; every poll renews it. */
export const DESTINATION_CLAIM_SECONDS = 60;

export const CLAIM_FAILURE_TEXT: Record<BackupDestinationClaimFailure, string> =
  {
    none_registered:
      'no backup destination is registered yet (add one on /exodus/backup)',
    no_match:
      'no registered destination is the export mounted at BACKUP_DESTINATION_PATH (or the pinned BACKUP_DESTINATION_ID)',
    held_by_other: 'the destination is served by another worker',
    ambiguous:
      'several destinations could be served; set BACKUP_DESTINATION_ID to pick one',
  };

/**
 * Takes the destination this worker serves. A pinned `BACKUP_DESTINATION_ID`
 * wins; otherwise the export mounted at `BACKUP_DESTINATION_PATH` decides, and
 * with the mount check off (local development) any free destination can be
 * served. The claimed id becomes `config.backupDestinationId`, which the copy
 * engine reads.
 */
export const claimDestination = async (): Promise<
  | { destination: BackupDestinationWithHost }
  | { reason: BackupDestinationClaimFailure }
> => {
  const mount =
    config.backupDestinationMountCheck === 'nfs'
      ? mountedExport(
          parseProcMounts(await fsPromises.readFile('/proc/mounts', 'utf8')),
          config.backupDestinationPath,
        )
      : null;

  const result = await claimBackupDestination(db, {
    workerId,
    leaseSeconds: DESTINATION_CLAIM_SECONDS,
    destinationId: config.backupDestinationId || undefined,
    mount,
  });

  if ('destination' in result) {
    config.backupDestinationId = result.destination.id;
  }

  return result;
};

/** False when the claim is gone: the worker must stop serving the destination. */
export const renewDestinationClaim = (id: string): Promise<boolean> =>
  renewBackupDestinationClaim(db, id, {
    workerId,
    leaseSeconds: DESTINATION_CLAIM_SECONDS,
  });

export const releaseDestinationClaim = (id: string): Promise<void> =>
  releaseBackupDestinationClaim(db, id, workerId);
