import { hashFile } from '@abbottland/video-db';
import type { Step } from '../../pipeline';
import type { PawPatrolFileSuggestionsContext } from '../context';

/**
 * Adds each episode's SHA-256 content hash onto the episode objects
 * listSeasonFiles built — the identity key both title_cards and
 * file_renames are keyed on.
 */
export const hashEpisodeFiles: Step<PawPatrolFileSuggestionsContext> = async (
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
