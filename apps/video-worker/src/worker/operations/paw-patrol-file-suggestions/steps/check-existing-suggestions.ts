import { listFileRenames } from '@abbottland/video-db';
import { db } from '../../../../db';
import { JobProcessingError } from '../../../job-processing-error';
import type { Step } from '../../pipeline';
import type { PawPatrolFileSuggestionsContext } from '../context';

/**
 * Looks up an existing file_renames row for each episode's file hash. This
 * is the job's idempotency check: an episode that already has a suggestion
 * is done — later steps (title-card lookup, the Sonarr call, the AI
 * request) all skip an episode with existingSuggestion set, so re-running
 * this job over a season that's already fully suggested does no work
 * beyond this lookup.
 */
export const checkExistingSuggestions: Step<
  PawPatrolFileSuggestionsContext
> = async (ctx) => {
  const episodes = await Promise.all(
    ctx.episodes.map(async (episode) => {
      if (!episode.hash) {
        throw new JobProcessingError(
          `episode is missing a hash: ${episode.filename}`,
        );
      }

      const [existingSuggestion] = await listFileRenames(db, {
        fileHash: episode.hash,
      });

      return { ...episode, existingSuggestion };
    }),
  );

  return { ...ctx, episodes };
};
