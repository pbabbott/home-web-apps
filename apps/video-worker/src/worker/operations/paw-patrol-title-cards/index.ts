import type { VideoJob } from '@abbottland/video-db';
import { config } from '../../../config';
import { JobProcessingError } from '../../job-processing-error';
import type { OperationResult } from '../operation-result';
import { runSteps } from '../pipeline';
import type { PawPatrolTitleCardsContext } from './context';
import type { Episode } from './episode';
import { isPawPatrolTitleCardsParameters } from './parameters';
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

const summarizeResult = (context: PawPatrolTitleCardsContext): string => {
  const processed = context.episodes.filter(wasProcessedThisRun);
  const alreadyDone = context.episodes.length - processed.length;
  const titleCardsWritten = processed.reduce(
    (sum, episode) => sum + (episode.titleCards?.length ?? 0),
    0,
  );
  const noTitleCardFound = processed.filter(
    (episode) => (episode.titleCards?.length ?? 0) === 0,
  ).length;

  const parts = [
    `processed ${processed.length} episode(s)`,
    `${context.outputPaths.length} screenshot(s) generated`,
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

export const runPawPatrolTitleCardsOperation = async (
  job: VideoJob,
): Promise<OperationResult> => {
  if (!isPawPatrolTitleCardsParameters(job.parameters)) {
    throw new JobProcessingError('parameters.seasonNumber must be a number');
  }

  const context = await runSteps(
    {
      job,
      seasonNumber: job.parameters.seasonNumber,
      model: job.parameters.model ?? config.aiModel,
      episodes: [],
      outputPaths: [],
    },
    steps,
  );

  return {
    outputPaths: context.outputPaths,
    message: summarizeResult(context),
  };
};
