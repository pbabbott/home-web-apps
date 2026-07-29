import type { VideoJob } from '@abbottland/video-db';
import type { OperationResult } from './operation-result';
import { runPawPatrolApplyFileRenamesOperation } from './paw-patrol-apply-file-renames';
import { runPawPatrolFileSuggestionsOperation } from './paw-patrol-file-suggestions';
import { runPawPatrolTitleCardsOperation } from './paw-patrol-title-cards';

export type { OperationResult } from './operation-result';

/**
 * Maps a job's `operation` to the handler that processes it and returns the
 * output paths (relative to MEDIA_ROOT) and a human-readable success
 * message to record on the job. Adding a new operation means adding an
 * entry here, not changing the queue or worker loop.
 */
export const operationHandlers: Record<
  string,
  (job: VideoJob) => Promise<OperationResult>
> = {
  paw_patrol_title_cards: runPawPatrolTitleCardsOperation,
  paw_patrol_file_suggestions: runPawPatrolFileSuggestionsOperation,
  paw_patrol_apply_file_renames: runPawPatrolApplyFileRenamesOperation,
};
