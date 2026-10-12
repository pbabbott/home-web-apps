import {
  getSeasonEpisodes,
  getSeriesByTitle,
} from '../../../../api/sonarr/sonarr-client';
import type { Step } from '../../pipeline';
import { SHOW_DIRECTORY_NAME } from '../../paw-patrol-title-cards/lib/paths';
import type { PawPatrolFileSuggestionsContext } from '../context';

/**
 * Fetches the season's official episode list from Sonarr once per job run
 * — every episode's suggestion is matched against the same list, so this
 * runs before the per-episode AI step rather than being repeated per
 * episode. Skipped entirely if every episode already has a suggestion,
 * since nothing downstream would use the result.
 */
export const fetchSonarrEpisodes: Step<
  PawPatrolFileSuggestionsContext
> = async (ctx) => {
  const needsSuggestions = ctx.episodes.some(
    (episode) => !episode.existingSuggestion,
  );

  if (!needsSuggestions) {
    return ctx;
  }

  const series = await getSeriesByTitle(SHOW_DIRECTORY_NAME);
  const sonarrEpisodes = await getSeasonEpisodes(series.id, ctx.seasonNumber);

  return { ...ctx, sonarrEpisodes };
};
