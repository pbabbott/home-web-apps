import { execFile } from 'child_process';
import { promisify } from 'util';
import { config } from '../../../../config';

const execFileAsync = promisify(execFile);

/** How far (seconds) on either side of the target to probe for keyframes. */
const PROBE_WINDOW_SECONDS = 15;

/**
 * Real keyframe (I-frame) presentation timestamps near `aroundSeconds`,
 * ascending. Scoped to a window via -read_intervals so this doesn't scan
 * the whole file. We probe actual keyframes rather than assuming a fixed
 * framerate/GOP-interval formula — this library's WEBDL/HDTV rips can have
 * scene-adaptive (irregular) keyframe spacing, so real data is the only
 * reliable source.
 */
export const probeKeyframeTimes = async (
  absPath: string,
  aroundSeconds: number,
): Promise<number[]> => {
  const start = Math.max(0, aroundSeconds - PROBE_WINDOW_SECONDS);
  const end = aroundSeconds + PROBE_WINDOW_SECONDS;

  const { stdout } = await execFileAsync(config.ffprobePath, [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-skip_frame',
    'nokey',
    '-show_entries',
    'frame=pts_time',
    '-read_intervals',
    `${start}%${end}`,
    '-of',
    'csv=p=0',
    absPath,
  ]);

  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(Number)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
};

/**
 * Nearest keyframe timestamp to `targetSeconds` by absolute distance (a tie
 * favors the earlier one). null for an empty list — the caller treats that
 * as "no keyframe found near the split point" rather than guessing.
 */
export const nearestKeyframe = (
  keyframeTimes: number[],
  targetSeconds: number,
): number | null => {
  if (keyframeTimes.length === 0) return null;

  return keyframeTimes.reduce((best, candidate) =>
    Math.abs(candidate - targetSeconds) < Math.abs(best - targetSeconds)
      ? candidate
      : best,
  );
};
