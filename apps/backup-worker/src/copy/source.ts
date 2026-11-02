import {
  getHostById,
  getSourceById,
  getSourceConnection,
  type BackupJob,
  type Database,
} from '@abbottland/homelab-db';
import {
  buildConnectionTarget,
  type ConnectionTarget,
} from '@abbottland/source-access';

/** The source of a job and everything needed to reach it, password decrypted. */
export const loadSourceTarget = async (
  db: Database,
  job: Pick<BackupJob, 'sourceId'>,
): Promise<{ connectionType: 'smb'; target: ConnectionTarget }> => {
  const source = await getSourceById(db, job.sourceId);

  if (!source) throw new Error('the source of this job no longer exists');

  const connection = await getSourceConnection(db, job.sourceId);

  if (!connection) {
    throw new Error('the source has no connection configured');
  }

  const host = source.hostId ? await getHostById(db, source.hostId) : undefined;

  if (!host) throw new Error('the source is not linked to a host');

  return {
    connectionType: connection.connectionType,
    target: buildConnectionTarget(connection, host),
  };
};
