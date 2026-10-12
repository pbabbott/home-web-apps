import { listTitleCards } from '@abbottland/video-db';
import { db } from '../../../../db';
import { JobProcessingError } from '../../../job-processing-error';
import type { Step } from '../../pipeline';
import type { PawPatrolTitleCardsContext } from '../context';

/**
 * Looks up existing title_cards rows for each episode's file hash. An
 * episode with at least one record already has title-card data and can
 * continue through the pipeline as-is; an episode with none needs that
 * data generated before a record can be inserted — handled by a later
 * step.
 */
export const checkTitleCardRecords: Step<PawPatrolTitleCardsContext> = async (
  ctx,
) => {
  const episodes = await Promise.all(
    ctx.episodes.map(async (episode) => {
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
