import {
  BackupError,
  listActiveBackupJobs,
  markBackupDestinationUnhealthy,
  resumeBackupJob,
  stallBackupJob,
  type BackupJob,
  type BackupJobStalledReason,
} from '@abbottland/homelab-db';
import {
  getConnectionDriver,
  type ConnectionDriver,
} from '@abbottland/source-access';
import { db } from '../db';
import { systemActor, workerId } from '../worker-id';
import { DESTINATION_KEY, sourceKey, type PauseTracker } from './pause-tracker';
import { loadSourceTarget } from './source';

/** A job that finished while we were looking at it needs no pause. */
const ignoreFinished = (err: unknown): void => {
  if (
    err instanceof BackupError &&
    ['conflict', 'not_found'].includes(err.code)
  )
    return;
  throw err;
};

const stall = (job: BackupJob, reason: BackupJobStalledReason) =>
  stallBackupJob(db, job.id, reason, systemActor()).catch(ignoreFinished);

/** Pauses the claims of every active job of this destination (no attempts are spent while paused). */
export const stallDestinationJobs = async (
  pauses: PauseTracker,
  destinationId: string,
): Promise<void> => {
  const jobs = await listActiveBackupJobs(db, destinationId);

  for (const job of jobs) await stall(job, 'destination_unhealthy');
  pauses.fail(DESTINATION_KEY);
};

/** The destination is broken: mark it unhealthy and pause its jobs. */
export const pauseDestination = async (
  pauses: PauseTracker,
  destinationId: string,
  reason: string,
): Promise<void> => {
  await markBackupDestinationUnhealthy(db, destinationId, {
    workerId,
    reason,
  });
  await stallDestinationJobs(pauses, destinationId);
};

/** The destination validated again: let its paused jobs run. */
export const resumeDestinationJobs = async (
  destinationId: string,
): Promise<void> => {
  const jobs = await listActiveBackupJobs(db, destinationId);

  for (const job of jobs) {
    if (job.stalledReason === 'destination_unhealthy') {
      await resumeBackupJob(db, job.id, systemActor()).catch(ignoreFinished);
    }
  }
};

/** The source of the job's item stopped answering: pause the job. */
export const pauseSource = async (
  pauses: PauseTracker,
  job: BackupJob,
): Promise<void> => {
  await stall(job, 'source_unreachable');
  pauses.fail(sourceKey(job.id));
};

/**
 * For each job paused because its source did not answer, once its wait is
 * over: ask the source. An answer resumes the job; silence waits longer.
 */
export const resumeReachableSources = async (
  pauses: PauseTracker,
  destinationId: string,
  driver?: ConnectionDriver,
): Promise<void> => {
  const jobs = await listActiveBackupJobs(db, destinationId);

  for (const job of jobs) {
    const key = sourceKey(job.id);

    if (job.stalledReason !== 'source_unreachable' || !pauses.due(key))
      continue;

    try {
      const { connectionType, target } = await loadSourceTarget(db, job);
      const probe = await (driver ?? getConnectionDriver(connectionType)).test(
        target,
      );

      if (probe.ok) {
        await resumeBackupJob(db, job.id, systemActor()).catch(ignoreFinished);
        console.log(`✅ source of job ${job.id} answers again, resuming`);
      } else {
        pauses.fail(key);
      }
    } catch (err) {
      pauses.fail(key);
      console.error(`⚠️  could not check the source of job ${job.id}:`, err);
    }
  }
};
