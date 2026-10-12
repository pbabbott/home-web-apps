import type { VideoJob } from '@abbottland/video-db';
import type { OperationResult } from './operation-result';
import { runApplyFileRenamesOperation } from './apply-file-renames';
import { runFileSuggestionsOperation } from './file-suggestions';
import { runTitleCardsOperation } from './title-cards';

export type { OperationResult } from './operation-result';

/**
 * Maps a job's `operation` to the handler that processes it and returns a
 * human-readable success message to record on the job. Adding a new
 * operation means adding an entry here, not changing the queue or worker
 * loop.
 */
export const operationHandlers: Record<
  string,
  (job: VideoJob) => Promise<OperationResult>
> = {
  title_cards: runTitleCardsOperation,
  file_suggestions: runFileSuggestionsOperation,
  apply_file_renames: runApplyFileRenamesOperation,
};
