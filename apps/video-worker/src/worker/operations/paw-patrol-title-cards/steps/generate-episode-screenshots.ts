import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { config } from '../../../../config';
import { resolveWithinRoot } from '../../../../lib/safe-path';
import { JobProcessingError } from '../../../job-processing-error';
import type { Step } from '../../pipeline';
import type { PawPatrolTitleCardsContext } from '../context';
import { screenshotDirectoryRelPath } from '../lib/paths';

const execFileAsync = promisify(execFile);

const SCREENSHOT_WIDTH = 480;
const SCREENSHOT_HEIGHT = 270;
const SAMPLE_WINDOW_SECONDS = 15;
const SAMPLE_INTERVAL_SECONDS = 2;
const FIRST_SAMPLE_CENTER_SECONDS = 45;
/** Second sampling center, only used for episodes longer than SECOND_SAMPLE_RUNTIME_THRESHOLD_SECONDS. */
const SECOND_SAMPLE_CENTER_SECONDS = 705;
const SECOND_SAMPLE_RUNTIME_THRESHOLD_SECONDS = 780;

/**
 * Timestamps to screenshot around `centerSeconds`: the center itself, plus
 * samples every SAMPLE_INTERVAL_SECONDS out to (but not exceeding)
 * +/- SAMPLE_WINDOW_SECONDS. E.g. with center 45, window 15, interval 2
 * that's 31, 33, ..., 43, 45, 47, ..., 59.
 */
const buildSampleTimestamps = (centerSeconds: number): number[] => {
  const maxOffset =
    Math.floor(SAMPLE_WINDOW_SECONDS / SAMPLE_INTERVAL_SECONDS) *
    SAMPLE_INTERVAL_SECONDS;
  const timestamps: number[] = [];

  for (
    let offset = -maxOffset;
    offset <= maxOffset;
    offset += SAMPLE_INTERVAL_SECONDS
  ) {
    timestamps.push(centerSeconds + offset);
  }

  return timestamps;
};

/**
 * Samples around FIRST_SAMPLE_CENTER_SECONDS, plus a second batch around
 * SECOND_SAMPLE_CENTER_SECONDS for episodes long enough that a title card
 * might also appear there (over SECOND_SAMPLE_RUNTIME_THRESHOLD_SECONDS).
 */
const buildSampleTimestampsForEpisode = (runTimeSeconds: number): number[] => {
  const centers =
    runTimeSeconds > SECOND_SAMPLE_RUNTIME_THRESHOLD_SECONDS
      ? [FIRST_SAMPLE_CENTER_SECONDS, SECOND_SAMPLE_CENTER_SECONDS]
      : [FIRST_SAMPLE_CENTER_SECONDS];

  return centers.flatMap(buildSampleTimestamps);
};

/**
 * For each episode with no title_cards record, generates
 * SCREENSHOT_WIDTHxSCREENSHOT_HEIGHT screenshots at the sample timestamps
 * into `<MEDIA_ROOT>/screenshots/Paw Patrol/Season <N>/<fileHash>/<second>_<dimensions>.jpg`,
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

      if (episode.runTimeSeconds === undefined) {
        throw new JobProcessingError(
          `episode is missing a runtime: ${episode.filename}`,
        );
      }

      const screenshotDirRelPath = screenshotDirectoryRelPath(
        ctx.seasonNumber,
        episode.hash,
      );
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

      for (const timestamp of buildSampleTimestampsForEpisode(
        episode.runTimeSeconds,
      )) {
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
