import fs from 'fs';
import { config } from '../../../../config';
import { resolveWithinRoot } from '../../../../lib/safe-path';
import { JobProcessingError } from '../../../job-processing-error';
import type { Step } from '../../pipeline';
import type { PawPatrolTitleCardsContext } from '../context';
import type { Episode } from '../episode';
import {
  detectTitleCard,
  type TitleCardDetection,
} from '../lib/detect-title-card';
import { parseScreenshotTimestamp } from '../lib/paths';

const SCREENSHOT_MIME_TYPE = 'image/jpeg';

/**
 * For each episode with no title_cards record, asks the AI API (via
 * detectTitleCard, DB-cached) whether each of its generated screenshots
 * shows the title card, recording one TitleCardDetection per screenshot.
 * Checked one screenshot at a time, across every episode — same reasoning
 * as screenshot generation: this hits a single local AI server, so
 * requests shouldn't overlap. Episodes that already have title_cards
 * records pass through unchanged.
 */
export const detectEpisodeTitleCards: Step<PawPatrolTitleCardsContext> = async (
  ctx,
) => {
  const episodes: Episode[] = [];

  for (const episode of ctx.episodes) {
    if (episode.titleCards && episode.titleCards.length > 0) {
      episodes.push(episode);
      continue;
    }

    if (!episode.screenshotPaths || episode.screenshotPaths.length === 0) {
      throw new JobProcessingError(
        `episode is missing screenshots: ${episode.filename}`,
      );
    }

    const titleCardDetections: TitleCardDetection[] = [];

    for (const screenshotPath of episode.screenshotPaths) {
      const screenshotAbsPath = resolveWithinRoot(
        config.mediaRoot,
        screenshotPath,
      );

      if (!screenshotAbsPath) {
        throw new JobProcessingError(
          `screenshot path escapes MEDIA_ROOT: ${screenshotPath}`,
        );
      }

      const imageBase64 = fs.readFileSync(screenshotAbsPath).toString('base64');
      const result = await detectTitleCard(
        screenshotPath,
        imageBase64,
        SCREENSHOT_MIME_TYPE,
      );

      titleCardDetections.push({
        screenshotPath,
        screenshotBase64: imageBase64,
        timestampSeconds: parseScreenshotTimestamp(screenshotPath),
        ...result,
      });
    }

    episodes.push({ ...episode, titleCardDetections });
  }

  return { ...ctx, episodes };
};
