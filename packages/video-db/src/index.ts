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
  claimNextVideoJob,
  heartbeatVideoJob,
  completeVideoJob,
  failVideoJob,
} from './queries/video-jobs';
export type {
  CreateVideoJobInput,
  ListVideoJobsOptions,
} from './queries/video-jobs';

export { titleCards, titleCardSelectSchema } from './schema/title-cards';
export type { TitleCard, NewTitleCard } from './schema/title-cards';

export {
  upsertTitleCard,
  getTitleCardById,
  listTitleCards,
} from './queries/title-cards';
export type {
  UpsertTitleCardInput,
  ListTitleCardsOptions,
} from './queries/title-cards';

export {
  fileRenames,
  fileRenameStatusEnum,
  fileRenameSelectSchema,
} from './schema/file-renames';
export type {
  FileRename,
  NewFileRename,
  FileRenameStatus,
} from './schema/file-renames';

export {
  upsertFileRename,
  getFileRenameById,
  updateFileRenameStatus,
  listFileRenames,
} from './queries/file-renames';
export type {
  UpsertFileRenameInput,
  ListFileRenamesOptions,
} from './queries/file-renames';

export {
  runMigrations,
  runMigrationsWithLock,
  MIGRATIONS_FOLDER,
} from './migrations';
