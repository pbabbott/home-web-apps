export { createDb, closeDb, pingDb } from './client';
export type { Database, PostgresConnectionOptions } from './client';

export {
  videoJobs,
  videoJobStatusEnum,
  videoJobSelectSchema,
} from './schema/video-jobs';
export type {
  VideoJob,
  NewVideoJob,
  VideoJobStatus,
} from './schema/video-jobs';

export {
  createVideoJob,
  getVideoJobById,
  listVideoJobs,
} from './queries/video-jobs';
export type {
  CreateVideoJobInput,
  ListVideoJobsOptions,
} from './queries/video-jobs';

export { runMigrations, MIGRATIONS_FOLDER } from './migrations';
