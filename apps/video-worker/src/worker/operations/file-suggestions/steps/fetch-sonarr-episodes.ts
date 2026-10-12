import {
  getSeasonEpisodes,
  getSeriesByTitle,
} from '../../../../api/sonarr/sonarr-client';
import type { Step } from '../../pipeline';
import type { FileSuggestionsContext } from '../context';

/**
 * Fetches the season's official episode list from Sonarr once per job run
 * — every episode's suggestion is matched against the same list, so this
 * runs before the per-episode AI step rather than being repeated per
 * episode. Skipped entirely if every episode already has a suggestion,
 * since nothing downstream would use the result.
 */
export const fetchSonarrEpisodes: Step<FileSuggestionsContext> = async (
  ctx,
) => {
  const needsSuggestions = ctx.episodes.some(
    (episode) => !episode.existingSuggestion,
  );

  if (!needsSuggestions) {
    return ctx;
  }

  const sonarrSeries = await getSeriesByTitle(ctx.series.seriesName);
  const sonarrEpisodes = await getSeasonEpisodes(
    sonarrSeries.id,
    ctx.seasonNumber,
  );

  return { ...ctx, sonarrEpisodes };
};
