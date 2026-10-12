import { getSeriesByName, type VideoJob } from '@abbottland/video-db';
import { config } from '../../../config';
import { db } from '../../../db';
import { JobProcessingError } from '../../job-processing-error';
import type { OperationResult } from '../operation-result';
import { runSteps } from '../pipeline';
import type { TitleCardsContext } from './context';
import type { Episode } from './episode';
import { isTitleCardsParameters } from './parameters';
import { steps } from './steps';

/**
 * An episode only gets `titleCardDetections` from detect-episode-title-cards
 * (and downstream `titleCards` from insert-episode-title-cards) when it
 * arrived at this run with no existing title_cards record — episodes that
 * already had one pass through every step unchanged. That's the only signal
 * available for "processed this run" vs. "already done", so it doubles as
 * the summary's episode-level split.
 */
const wasProcessedThisRun = (episode: Episode): boolean =>
  episode.titleCardDetections !== undefined;

const summarizeResult = (context: TitleCardsContext): string => {
  const processed = context.episodes.filter(wasProcessedThisRun);
  const alreadyDone = context.episodes.length - processed.length;
  const titleCardsWritten = processed.reduce(
    (sum, episode) => sum + (episode.titleCards?.length ?? 0),
    0,
  );
  const noTitleCardFound = processed.filter(
    (episode) => (episode.titleCards?.length ?? 0) === 0,
  ).length;

  const screenshotsGenerated = context.episodes.reduce(
    (sum, episode) => sum + (episode.screenshotPaths?.length ?? 0),
    0,
  );

  const parts = [
    `processed ${processed.length} episode(s)`,
    `${screenshotsGenerated} screenshot(s) generated`,
    `${titleCardsWritten} title card record(s) written`,
  ];

  if (alreadyDone > 0) {
    parts.push(`${alreadyDone} already had title cards`);
  }

  if (noTitleCardFound > 0) {
    parts.push(`${noTitleCardFound} with no title card detected`);
  }

  return parts.join(', ');
};

export const runTitleCardsOperation = async (
  job: VideoJob,
): Promise<OperationResult> => {
  if (!isTitleCardsParameters(job.parameters)) {
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
    },
    steps,
  );

  return {
    message: summarizeResult(context),
  };
};
