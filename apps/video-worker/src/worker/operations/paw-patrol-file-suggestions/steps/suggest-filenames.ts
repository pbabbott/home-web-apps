import path from 'path';
import type { Step } from '../../pipeline';
import {
  buildPlexEpisodeRelPath,
  buildPlexMultiEpisodeRelPath,
} from '../lib/plex-filename';
import { suggestDoubleEpisode } from '../lib/suggest-double-episode';
import { suggestSingleEpisode } from '../lib/suggest-single-episode';
import type { PawPatrolFileSuggestionsContext } from '../context';

/**
 * Asks the AI to match each remaining episode (no existingSuggestion) to
 * its official Sonarr episode(s), using its title-card text as evidence,
 * and computes the Plex-standard destination path from the match. A file
 * with one detected title card is matched with suggestSingleEpisode; a
 * file with two (this show routinely bundles two shorts per file) is
 * matched with suggestDoubleEpisode, which asks a differently-shaped
 * question and returns a Plex multi-episode (sXXeYY-eZZ) path. Three or
 * more title cards falls back to matching just the first two — outside
 * this pipeline's current scope. An episode with no title_cards yet (the
 * title-cards job hasn't processed it) or no confident AI match is left
 * without a suggestedFilePath — it's picked up on a future run once
 * evidence exists, rather than saving a guess.
 */
export const suggestFilenames: Step<PawPatrolFileSuggestionsContext> = async (
  ctx,
) => {
  const episodes = await Promise.all(
    ctx.episodes.map(async (episode) => {
      const titleCards = episode.titleCards;

      if (episode.existingSuggestion || !titleCards?.length) {
        return episode;
      }

      const extension = path.extname(episode.filename);

      if (titleCards.length === 1) {
        const match = await suggestSingleEpisode(
          episode.filename,
          titleCards[0].title ?? '',
          ctx.sonarrEpisodes,
        );

        if (!match.found) {
          return episode;
        }

        return {
          ...episode,
          suggestedFilePath: buildPlexEpisodeRelPath(
            ctx.seasonNumber,
            match.episodeNumber,
            match.episodeTitle,
            extension,
          ),
        };
      }

      const match = await suggestDoubleEpisode(
        episode.filename,
        titleCards[0].title ?? '',
        titleCards[1].title ?? '',
        ctx.sonarrEpisodes,
      );

      if (!match.found) {
        return episode;
      }

      const [first, second] = match.episodes;

      return {
        ...episode,
        suggestedFilePath: buildPlexMultiEpisodeRelPath(
          ctx.seasonNumber,
          first.episodeNumber,
          second.episodeNumber,
          first.episodeTitle,
          second.episodeTitle,
          extension,
        ),
      };
    }),
  );

  return { ...ctx, episodes };
};
