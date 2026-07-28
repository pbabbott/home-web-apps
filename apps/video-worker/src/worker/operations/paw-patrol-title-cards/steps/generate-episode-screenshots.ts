import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { config } from '../../../../config';
import { resolveWithinRoot } from '../../../../lib/safe-path';
import { JobProcessingError } from '../../../job-processing-error';
import type { Step } from '../../pipeline';
import type { PawPatrolTitleCardsContext } from '../context';
import { seasonDirectoryRelPath } from '../paths';

const execFileAsync = promisify(execFile);

const SCREENSHOT_WIDTH = 480;
const SCREENSHOT_HEIGHT = 270;
const SAMPLE_TIMESTAMP_SECONDS = 45;
const SAMPLE_WINDOW_SECONDS = 15;
const SAMPLE_INTERVAL_SECONDS = 2;

/**
 * Timestamps to screenshot: SAMPLE_TIMESTAMP_SECONDS itself, plus samples
 * every SAMPLE_INTERVAL_SECONDS out to (but not exceeding)
 * +/- SAMPLE_WINDOW_SECONDS, symmetric around the center. E.g. with
 * 45 / 15 / 2 that's 31, 33, ..., 43, 45, 47, ..., 59.
 */
const buildSampleTimestamps = (): number[] => {
  const maxOffset =
    Math.floor(SAMPLE_WINDOW_SECONDS / SAMPLE_INTERVAL_SECONDS) *
    SAMPLE_INTERVAL_SECONDS;
  const timestamps: number[] = [];

  for (
    let offset = -maxOffset;
    offset <= maxOffset;
    offset += SAMPLE_INTERVAL_SECONDS
  ) {
    timestamps.push(SAMPLE_TIMESTAMP_SECONDS + offset);
  }

  return timestamps;
};

/**
 * For each episode with no title_cards record, generates
 * SCREENSHOT_WIDTHxSCREENSHOT_HEIGHT screenshots at the sample timestamps
 * into `<MEDIA_ROOT>/Paw Patrol/Season <N>/<fileHash>/<second>_<dimensions>.jpg`,
 * skipping any that already exist. Episodes that already have title_cards
 * records pass through unchanged.
 */
export const generateEpisodeScreenshots: Step<
  PawPatrolTitleCardsContext
> = async (ctx) => {
  const outputPaths = [...ctx.outputPaths];

  const episodes = await Promise.all(
    ctx.episodes.map(async (episode) => {
      if (episode.titleCards && episode.titleCards.length > 0) {
        return episode;
      }

      if (!episode.hash) {
        throw new JobProcessingError(
          `episode is missing a hash: ${episode.filename}`,
        );
      }

      const screenshotDirRelPath = `${seasonDirectoryRelPath(ctx.seasonNumber)}/${episode.hash}`;
      const screenshotDirAbsPath = resolveWithinRoot(
        config.mediaRoot,
        screenshotDirRelPath,
      );

      if (!screenshotDirAbsPath) {
        throw new JobProcessingError(
          `screenshot directory escapes MEDIA_ROOT: ${screenshotDirRelPath}`,
        );
      }

      fs.mkdirSync(screenshotDirAbsPath, { recursive: true });

      const screenshotPaths: string[] = [];

      for (const timestamp of buildSampleTimestamps()) {
        const filename = `${timestamp}_${SCREENSHOT_WIDTH}x${SCREENSHOT_HEIGHT}.jpg`;
        const outputAbsPath = path.join(screenshotDirAbsPath, filename);

        if (!fs.existsSync(outputAbsPath)) {
          await execFileAsync(config.ffmpegPath, [
            '-ss',
            String(timestamp),
            '-i',
            episode.absPath,
            '-frames:v',
            '1',
            '-vf',
            `scale=${SCREENSHOT_WIDTH}:${SCREENSHOT_HEIGHT}`,
            '-y',
            outputAbsPath,
          ]);
        }

        const outputRelPath = `${screenshotDirRelPath}/${filename}`;
        screenshotPaths.push(outputRelPath);
        outputPaths.push(outputRelPath);
      }

      return { ...episode, screenshotPaths };
    }),
  );

  return { ...ctx, episodes, outputPaths };
};
