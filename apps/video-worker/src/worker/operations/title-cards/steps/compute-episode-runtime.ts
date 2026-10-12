import { getRuntimeSeconds } from '../../../../lib/get-runtime';
import type { Step } from '../../pipeline';
import type { PawPatrolTitleCardsContext } from '../context';

/**
 * Probes runtime (ffprobe) for episodes that don't already have a
 * title_cards record — those already have a known runTimeSeconds in the
 * database, so there's nothing to compute. Episodes with existing records
 * pass through unchanged.
 */
export const computeEpisodeRuntime: Step<PawPatrolTitleCardsContext> = async (
  ctx,
) => {
  const episodes = await Promise.all(
    ctx.episodes.map(async (episode) => {
      if (episode.titleCards && episode.titleCards.length > 0) {
        return episode;
      }

      return {
        ...episode,
        runTimeSeconds: await getRuntimeSeconds(episode.absPath),
      };
    }),
  );

  return { ...ctx, episodes };
};
