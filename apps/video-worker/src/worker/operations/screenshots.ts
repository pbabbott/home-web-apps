import { execFile } from 'child_process';
import fs from 'fs';
import { promisify } from 'util';
import type { VideoJob } from '@abbottland/video-db';
import { config } from '../../config';
import { resolveWithinRoot } from '../../lib/safe-path';
import { JobProcessingError } from '../job-processing-error';

const execFileAsync = promisify(execFile);

type ScreenshotParameters = {
  timestamps: number[];
};

const isScreenshotParameters = (
  value: unknown,
): value is ScreenshotParameters =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as ScreenshotParameters).timestamps) &&
  (value as ScreenshotParameters).timestamps.length > 0 &&
  (value as ScreenshotParameters).timestamps.every(
    (timestamp) => typeof timestamp === 'number',
  );

/**
 * Extracts one JPEG per timestamp in `job.parameters.timestamps` and writes
 * them to `screenshots/<jobId>/<timestamp>.jpg` under MEDIA_ROOT. Returns
 * the generated paths, relative to MEDIA_ROOT, in timestamp order.
 */
export const runScreenshotsOperation = async (
  job: VideoJob,
): Promise<string[]> => {
  if (!isScreenshotParameters(job.parameters)) {
    throw new JobProcessingError(
      'parameters.timestamps must be a non-empty array of numbers',
    );
  }

  const inputAbsPath = resolveWithinRoot(config.mediaRoot, job.inputPath);

  if (!inputAbsPath) {
    throw new JobProcessingError(
      `inputPath escapes MEDIA_ROOT: ${job.inputPath}`,
    );
  }

  if (!fs.existsSync(inputAbsPath)) {
    throw new JobProcessingError(`input file not found: ${job.inputPath}`);
  }

  const outputRelDir = `/screenshots/${job.id}`;
  const outputAbsDir = resolveWithinRoot(config.mediaRoot, outputRelDir);

  if (!outputAbsDir) {
    throw new JobProcessingError(
      'generated output directory escapes MEDIA_ROOT',
    );
  }

  fs.mkdirSync(outputAbsDir, { recursive: true });

  const outputPaths: string[] = [];

  for (const timestamp of job.parameters.timestamps) {
    const outputRelPath = `${outputRelDir}/${timestamp}.jpg`;
    const outputAbsPath = resolveWithinRoot(config.mediaRoot, outputRelPath);

    if (!outputAbsPath) {
      throw new JobProcessingError('generated output path escapes MEDIA_ROOT');
    }

    await execFileAsync(config.ffmpegPath, [
      '-ss',
      String(timestamp),
      '-i',
      inputAbsPath,
      '-frames:v',
      '1',
      '-y',
      outputAbsPath,
    ]);

    outputPaths.push(outputRelPath);
  }

  return outputPaths;
};
