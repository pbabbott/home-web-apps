import path from 'path';
import { JobProcessingError } from '../../../job-processing-error';
import type { Step } from '../../pipeline';
import {
  buildPlexEpisodeRelPath,
  extractQualityTag,
} from '../lib/plex-filename';
import { refineSplitPoint } from '../lib/refine-split-point';
import { suggestDoubleEpisode } from '../lib/suggest-double-episode';
import { suggestSingleEpisode } from '../lib/suggest-single-episode';
import type { PawPatrolFileSuggestionsContext } from '../context';

/**
 * Asks the AI to match each remaining episode (no existingSuggestion) to
 * its official Sonarr episode(s), using its title-card text as evidence,
 * and computes the Plex-standard destination path(s) from the match. A file
 * with one detected title card is matched with suggestSingleEpisode. A file
 * with two (this show routinely bundles two shorts per file) is matched
 * with suggestDoubleEpisode and recommended as a split: two separate
 * single-episode destination paths (suggestedFilePath and
 * secondSuggestedFilePath) plus splitAtSeconds, rather than one combined
 * multi-episode filename — nothing downstream actually cuts the file, so
 * this only records where a human or a future job should split it.
 * splitAtSeconds starts from the second title card's coarse (2s-grid)
 * timestamp but is refined down to ~0.1s precision by refineSplitPoint.
 * Three or more
 * title cards falls back to matching just the first two — outside this
 * pipeline's current scope. An
 * episode with no title_cards yet (the title-cards job hasn't processed it)
 * or no confident AI match is left without a suggestedFilePath — it's
 * picked up on a future run once evidence exists, rather than saving a
 * guess.
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
      const qualityTag = extractQualityTag(episode.filename);

      if (titleCards.length === 1) {
        const match = await suggestSingleEpisode(
          episode.filename,
          titleCards[0].title ?? '',
          ctx.sonarrEpisodes,
          ctx.model,
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
            qualityTag,
            extension,
          ),
          sourceTitleCardTitles: [titleCards[0].title ?? ''],
        };
      }

      const match = await suggestDoubleEpisode(
        episode.filename,
        titleCards[0].title ?? '',
        titleCards[1].title ?? '',
        ctx.sonarrEpisodes,
        ctx.model,
      );

      if (!match.found) {
        return episode;
      }

      if (!episode.hash) {
        throw new JobProcessingError(
          `episode is missing a hash: ${episode.filename}`,
        );
      }

      const [first, second] = match.episodes;

      const splitAtSeconds = await refineSplitPoint(
        ctx.seasonNumber,
        episode.hash,
        episode.absPath,
        titleCards[1].timestampSeconds,
      );

      return {
        ...episode,
        suggestedFilePath: buildPlexEpisodeRelPath(
          ctx.seasonNumber,
          first.episodeNumber,
          first.episodeTitle,
          qualityTag,
          extension,
        ),
        secondSuggestedFilePath: buildPlexEpisodeRelPath(
          ctx.seasonNumber,
          second.episodeNumber,
          second.episodeTitle,
          qualityTag,
          extension,
        ),
        splitAtSeconds,
        sourceTitleCardTitles: [
          titleCards[0].title ?? '',
          titleCards[1].title ?? '',
        ],
      };
    }),
  );

  return { ...ctx, episodes };
};
