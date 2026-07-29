import { upsertFileRename } from '@abbottland/video-db';
import { db } from '../../../../db';
import { JobProcessingError } from '../../../job-processing-error';
import type { Step } from '../../pipeline';
import { seasonDirectoryRelPath } from '../../paw-patrol-title-cards/lib/paths';
import type { PawPatrolFileSuggestionsContext } from '../context';

/**
 * Saves a file_renames row for every episode suggestFilenames computed a
 * destination for. Episodes that already had a suggestion, or that
 * suggestFilenames left without one (no title cards yet, or no confident
 * AI match), are skipped — nothing to write.
 */
export const saveSuggestions: Step<PawPatrolFileSuggestionsContext> = async (
  ctx,
) => {
  const outputPaths: string[] = [];

  for (const episode of ctx.episodes) {
    if (episode.existingSuggestion || !episode.suggestedFilePath) {
      continue;
    }

    if (!episode.hash) {
      throw new JobProcessingError(
        `episode is missing a hash: ${episode.filename}`,
      );
    }

    const originalFilePath = `${seasonDirectoryRelPath(ctx.seasonNumber)}/${episode.filename}`;

    await upsertFileRename(db, {
      fileHash: episode.hash,
      originalFilePath,
      suggestedFilePath: episode.suggestedFilePath,
      secondSuggestedFilePath: episode.secondSuggestedFilePath,
      splitAtSeconds: episode.splitAtSeconds,
      sourceTitleCardTitles: episode.sourceTitleCardTitles,
    });

    outputPaths.push(episode.suggestedFilePath);
    if (episode.secondSuggestedFilePath) {
      outputPaths.push(episode.secondSuggestedFilePath);
    }
  }

  return { ...ctx, outputPaths };
};
