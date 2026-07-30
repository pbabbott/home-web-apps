import fs from 'fs';
import path from 'path';
import { config } from '../../../../config';
import { resolveWithinRoot } from '../../../../lib/safe-path';
import { JobProcessingError } from '../../../job-processing-error';
import type { Step } from '../../pipeline';
import type { PawPatrolTitleCardsContext } from '../context';
import { seasonDirectoryRelPath } from '../lib/paths';

/** Lists the episode files in `<MEDIA_ROOT>/media/tv_shows/Paw Patrol/Season <N>`. */
export const listSeasonFiles: Step<PawPatrolTitleCardsContext> = async (
  ctx,
) => {
  const seasonRelPath = seasonDirectoryRelPath(ctx.seasonNumber);
  const seasonAbsPath = resolveWithinRoot(config.mediaRoot, seasonRelPath);

  if (!seasonAbsPath) {
    throw new JobProcessingError(
      `season path escapes MEDIA_ROOT: ${seasonRelPath}`,
    );
  }

  if (
    !fs.existsSync(seasonAbsPath) ||
    !fs.statSync(seasonAbsPath).isDirectory()
  ) {
    throw new JobProcessingError(
      `season directory not found: ${seasonRelPath}`,
    );
  }

  const episodes = fs
    .readdirSync(seasonAbsPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      filename: entry.name,
      absPath: path.join(seasonAbsPath, entry.name),
    }));

  return { ...ctx, episodes };
};
