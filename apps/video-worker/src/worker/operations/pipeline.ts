import type { VideoJob } from '@abbottland/video-db';
import {
  completeVideoJobStep,
  createVideoJobStep,
  failVideoJobStep,
} from '@abbottland/video-db';
import { db } from '../../db';

/**
 * One unit of a multi-step operation. Takes the operation's accumulated
 * context and returns the next context — steps run in array order and each
 * sees the previous step's output, so later steps can depend on state
 * earlier ones produced (e.g. a resolved file path, a detected timestamp).
 */
export type Step<Context> = (ctx: Context) => Promise<Context>;

/**
 * A `Step` plus the metadata runSteps needs to record its lifecycle in
 * video_job_steps: `name` identifies the step, `message` is what it's
 * about to do (shown while in_progress, then echoed back with a "— done"
 * suffix on success, or replaced with the error message on failure).
 */
export type NamedStep<Context> = {
  name: string;
  message: string;
  run: Step<Context>;
};

/**
 * Runs each step in order, writing a video_job_steps row for every one:
 * created in_progress right before it starts, then marked completed/failed
 * right after it settles. A step's failure is recorded before rethrowing,
 * so the existing job-level failure handling in job-processor.ts is
 * untouched — this only adds visibility, it doesn't change control flow.
 */
export const runSteps = async <Context extends { job: VideoJob }>(
  ctx: Context,
  steps: NamedStep<Context>[],
): Promise<Context> => {
  let current = ctx;

  for (const step of steps) {
    const stepRow = await createVideoJobStep(db, {
      jobId: current.job.id,
      stepName: step.name,
      message: step.message,
    });

    try {
      current = await step.run(current);
      await completeVideoJobStep(db, stepRow.id, `${step.message} — done`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      await failVideoJobStep(db, stepRow.id, message);
      throw err;
    }
  }

  return current;
};
