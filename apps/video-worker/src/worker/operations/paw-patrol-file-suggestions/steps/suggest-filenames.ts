import path from 'path';
import type { Step } from '../../pipeline';
import { buildPlexEpisodeRelPath } from '../lib/plex-filename';
import { suggestEpisode } from '../lib/suggest-episode';
import type { PawPatrolFileSuggestionsContext } from '../context';

/**
 * Asks the AI to match each remaining episode (no existingSuggestion) to
 * one of ctx.sonarrEpisodes, using its title-card text as evidence, and
 * computes the Plex-standard destination path from the match. An episode
 * with no title_cards yet (the title-cards job hasn't processed it) or no
 * confident AI match is left without a suggestedFilePath — it's picked up
 * on a future run once evidence exists, rather than saving a guess.
 */
export const suggestFilenames: Step<PawPatrolFileSuggestionsContext> = async (
  ctx,
) => {
  const episodes = await Promise.all(
    ctx.episodes.map(async (episode) => {
      if (episode.existingSuggestion || !episode.titleCards?.length) {
        return episode;
      }

      const match = await suggestEpisode(
        episode.filename,
        episode.titleCards.map((titleCard) => titleCard.title ?? ''),
        ctx.sonarrEpisodes,
      );

      if (!match.found) {
        return episode;
      }

      const suggestedFilePath = buildPlexEpisodeRelPath(
        ctx.seasonNumber,
        match.episodeNumber,
        match.episodeTitle,
        path.extname(episode.filename),
      );

      return { ...episode, suggestedFilePath };
    }),
  );

  return { ...ctx, episodes };
};
