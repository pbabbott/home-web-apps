import { listTitleCards } from '@abbottland/video-db';
import { db } from '../../../../db';
import { JobProcessingError } from '../../../job-processing-error';
import type { Step } from '../../pipeline';
import type { PawPatrolFileSuggestionsContext } from '../context';

/**
 * Loads existing title_cards rows for each episode that still needs a
 * suggestion — the evidence the AI step matches against Sonarr's official
 * episode list. Episodes with an existingSuggestion are skipped (already
 * done, per checkExistingSuggestions).
 */
export const loadTitleCards: Step<PawPatrolFileSuggestionsContext> = async (
  ctx,
) => {
  const episodes = await Promise.all(
    ctx.episodes.map(async (episode) => {
      if (episode.existingSuggestion) {
        return episode;
      }

      if (!episode.hash) {
        throw new JobProcessingError(
          `episode is missing a hash: ${episode.filename}`,
        );
      }

      return {
        ...episode,
        titleCards: await listTitleCards(db, { fileHash: episode.hash }),
      };
    }),
  );

  return { ...ctx, episodes };
};
