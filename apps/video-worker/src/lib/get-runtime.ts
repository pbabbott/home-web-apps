import { execFile } from 'child_process';
import { promisify } from 'util';
import { config } from '../config';

const execFileAsync = promisify(execFile);

/**
 * Runs ffprobe against `absPath` and returns the file's duration in whole
 * seconds (rounded, since callers only need enough precision to eyeball how
 * many title cards a file should have).
 */
export const getRuntimeSeconds = async (absPath: string): Promise<number> => {
  const { stdout } = await execFileAsync(config.ffprobePath, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    absPath,
  ]);

  return Math.round(Number(stdout.trim()));
};
