import { hashFile } from '@abbottland/video-db';
import type { Step } from '../../pipeline';
import type { PawPatrolTitleCardsContext } from '../context';

/**
 * Adds each episode's SHA-256 content hash (video-db's hashFile, shared
 * with video-api's title-card/file-rename identity) onto the episode
 * objects listSeasonFiles built.
 */
export const hashEpisodeFiles: Step<PawPatrolTitleCardsContext> = async (
  ctx,
) => {
  const episodes = await Promise.all(
    ctx.episodes.map(async (episode) => ({
      ...episode,
      hash: await hashFile(episode.absPath),
    })),
  );

  return { ...ctx, episodes };
};
