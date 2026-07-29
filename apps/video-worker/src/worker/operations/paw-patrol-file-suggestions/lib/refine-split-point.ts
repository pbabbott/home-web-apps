import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { config } from '../../../../config';
import { resolveWithinRoot } from '../../../../lib/safe-path';
import { JobProcessingError } from '../../../job-processing-error';
import { detectTitleCard } from '../../paw-patrol-title-cards/lib/detect-title-card';
import { screenshotDirectoryRelPath } from '../../paw-patrol-title-cards/lib/paths';

const execFileAsync = promisify(execFile);

const SCREENSHOT_WIDTH = 480;
const SCREENSHOT_HEIGHT = 270;
const SCREENSHOT_MIME_TYPE = 'image/jpeg';
const REFINE_STEP_SECONDS = 0.1;
/**
 * generateEpisodeScreenshots samples the coarse detection grid every 2s, so
 * a title card's real onset is somewhere in the 2s before the earliest
 * screenshot the AI confirmed as showing it — never further back, since the
 * previous coarse sample (2s earlier) was already checked and wasn't a
 * match. The extra 0.5s is slack for the edge case where the confirmed
 * screenshot was the first sample in its window, with no earlier coarse
 * sample to bound it.
 */
const MAX_BACK_SECONDS = 2.5;
const MAX_BACK_STEPS = Math.round(MAX_BACK_SECONDS / REFINE_STEP_SECONDS);

const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * Refines a title card's coarse (2s-grid) timestamp down to its actual
 * on-screen onset, by screenshotting backward from it in 0.1s steps and
 * asking the AI whether the card is still visible at each one. Stops at the
 * first step it isn't, returning the last timestamp it was — accurate to
 * within one 0.1s step. Bounded by MAX_BACK_STEPS rather than searching
 * indefinitely, since the coarse timestamp already bounds how far back the
 * true onset can be.
 *
 * Only called for the second title card of a to-be-split episode — that's
 * the one timestamp (suggestFilenames' splitAtSeconds) anyone acts on with
 * sub-second precision, so this is where the extra AI calls are worth it.
 * Screenshots are cached on disk and AI responses are cached via
 * detectTitleCard's ai_response_cache, but nothing here writes back to
 * title_cards — the coarse row is left as-is, and this refinement re-runs
 * on every call.
 */
export const refineSplitPoint = async (
  seasonNumber: number,
  fileHash: string,
  episodeAbsPath: string,
  coarseTimestampSeconds: number,
): Promise<number> => {
  const screenshotDirRelPath = screenshotDirectoryRelPath(
    seasonNumber,
    fileHash,
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

  let refinedTimestampSeconds = coarseTimestampSeconds;

  for (let step = 1; step <= MAX_BACK_STEPS; step++) {
    const timestamp = round1(
      coarseTimestampSeconds - step * REFINE_STEP_SECONDS,
    );

    if (timestamp < 0) break;

    const filename = `${timestamp}_refine_${SCREENSHOT_WIDTH}x${SCREENSHOT_HEIGHT}.jpg`;
    const outputAbsPath = path.join(screenshotDirAbsPath, filename);
    const outputRelPath = `${screenshotDirRelPath}/${filename}`;

    if (!fs.existsSync(outputAbsPath)) {
      await execFileAsync(config.ffmpegPath, [
        '-ss',
        String(timestamp),
        '-i',
        episodeAbsPath,
        '-frames:v',
        '1',
        '-vf',
        `scale=${SCREENSHOT_WIDTH}:${SCREENSHOT_HEIGHT}`,
        '-y',
        outputAbsPath,
      ]);
    }

    const imageBase64 = fs.readFileSync(outputAbsPath).toString('base64');
    const result = await detectTitleCard(
      outputRelPath,
      imageBase64,
      SCREENSHOT_MIME_TYPE,
    );

    if (!result.found) break;

    refinedTimestampSeconds = timestamp;
  }

  return refinedTimestampSeconds;
};
