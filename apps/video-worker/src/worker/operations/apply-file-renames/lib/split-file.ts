import { execFile } from 'child_process';
import { promisify } from 'util';
import { config } from '../../../../config';
import { nearestKeyframe, probeKeyframeTimes } from './keyframes';

const execFileAsync = promisify(execFile);

/**
 * Resolves splitAtSeconds (the AI-refined, ~0.1s-precise but not
 * necessarily keyframe-aligned estimate) down to the nearest real keyframe
 * in `absPath`, so both segments below can be cut losslessly with -c copy.
 * null means no keyframe was found in the probe window — the caller skips
 * the row rather than guessing a cut point.
 */
export const resolveCutPoint = async (
  absPath: string,
  splitAtSeconds: number,
): Promise<number | null> => {
  const keyframeTimes = await probeKeyframeTimes(absPath, splitAtSeconds);

  return nearestKeyframe(keyframeTimes, splitAtSeconds);
};

/** [0, cut) — the file's start through the chosen keyframe. */
const cutHead = (input: string, output: string, cutSeconds: number) =>
  execFileAsync(config.ffmpegPath, [
    '-v',
    'error',
    '-i',
    input,
    '-t',
    String(cutSeconds),
    '-map',
    '0',
    '-c',
    'copy',
    '-avoid_negative_ts',
    'make_zero',
    '-y',
    output,
  ]);

/**
 * [cut, end) — from the chosen keyframe through the file's end. -ss before
 * -i is a fast input-side seek; since `cutSeconds` is itself a real
 * keyframe timestamp (not an arbitrary point), stream copy lands exactly on
 * it rather than snapping to some other nearby keyframe.
 */
const cutTail = (input: string, output: string, cutSeconds: number) =>
  execFileAsync(config.ffmpegPath, [
    '-v',
    'error',
    '-ss',
    String(cutSeconds),
    '-i',
    input,
    '-map',
    '0',
    '-c',
    'copy',
    '-avoid_negative_ts',
    'make_zero',
    '-y',
    output,
  ]);

/**
 * Cuts `input` into two lossless (stream-copy, no re-encode) segments at
 * `cutSeconds`, both cut on the exact same keyframe boundary so the two
 * outputs are contiguous with the original — no gap, no duplicated frame.
 */
export const runSplit = async (
  input: string,
  headOutput: string,
  tailOutput: string,
  cutSeconds: number,
): Promise<void> => {
  console.log(`✂️  splitting ${input} at ${cutSeconds}s`);

  await cutHead(input, headOutput, cutSeconds);
  await cutTail(input, tailOutput, cutSeconds);
};
