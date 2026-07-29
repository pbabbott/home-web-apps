import type { VideoJob } from '@abbottland/video-db';
import { JobProcessingError } from '../../job-processing-error';
import type { OperationResult } from '../operation-result';
import { runSteps } from '../pipeline';
import { isPawPatrolFileSuggestionsParameters } from './parameters';
import { steps } from './steps';

export const runPawPatrolFileSuggestionsOperation = async (
  job: VideoJob,
): Promise<OperationResult> => {
  if (!isPawPatrolFileSuggestionsParameters(job.parameters)) {
    throw new JobProcessingError('parameters.seasonNumber must be a number');
  }

  const context = await runSteps(
    {
      job,
      seasonNumber: job.parameters.seasonNumber,
      episodes: [],
      sonarrEpisodes: [],
      outputPaths: [],
      message: '',
    },
    steps,
  );

  return { outputPaths: context.outputPaths, message: context.message };
};
