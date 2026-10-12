import { getSeriesByName, type VideoJob } from '@abbottland/video-db';
import { config } from '../../../config';
import { db } from '../../../db';
import { JobProcessingError } from '../../job-processing-error';
import type { OperationResult } from '../operation-result';
import { runSteps } from '../pipeline';
import { isFileSuggestionsParameters } from './parameters';
import { steps } from './steps';

export const runFileSuggestionsOperation = async (
  job: VideoJob,
): Promise<OperationResult> => {
  if (!isFileSuggestionsParameters(job.parameters)) {
    throw new JobProcessingError(
      'parameters.series must be a string and parameters.seasonNumber must be a number',
    );
  }

  const series = await getSeriesByName(db, job.parameters.series);

  if (!series) {
    throw new JobProcessingError(`no series named "${job.parameters.series}"`);
  }

  const context = await runSteps(
    {
      job,
      series,
      seasonNumber: job.parameters.seasonNumber,
      model: job.parameters.model ?? config.aiModel,
      episodes: [],
      sonarrEpisodes: [],
      message: '',
    },
    steps,
  );

  return { message: context.message };
};
