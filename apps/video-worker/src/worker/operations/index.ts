import type { VideoJob } from '@abbottland/video-db';
import { runScreenshotsOperation } from './screenshots';

/**
 * Maps a job's `operation` to the handler that processes it and returns the
 * output paths (relative to MEDIA_ROOT) to record on the job. Adding a new
 * operation means adding an entry here, not changing the queue or worker
 * loop.
 */
export const operationHandlers: Record<
  string,
  (job: VideoJob) => Promise<string[]>
> = {
  screenshots: runScreenshotsOperation,
};
