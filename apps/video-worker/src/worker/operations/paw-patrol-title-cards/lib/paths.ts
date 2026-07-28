export const SHOW_DIRECTORY_NAME = 'Paw Patrol';
const SCREENSHOTS_DIRECTORY_NAME = 'screenshots';

/** `<series>/<season>`, relative to MEDIA_ROOT — e.g. `Paw Patrol/Season 3`. */
export const seasonDirectoryRelPath = (seasonNumber: number): string =>
  `${SHOW_DIRECTORY_NAME}/Season ${seasonNumber}`;

/**
 * `screenshots/<series>/<season>/<fileHash>`, relative to MEDIA_ROOT — kept
 * out of the episode directories themselves so generated screenshots never
 * mix in with source video files.
 */
export const screenshotDirectoryRelPath = (
  seasonNumber: number,
  fileHash: string,
): string =>
  `${SCREENSHOTS_DIRECTORY_NAME}/${seasonDirectoryRelPath(seasonNumber)}/${fileHash}`;

/** Recovers the sample timestamp encoded in a `<second>_<dimensions>.jpg` screenshot filename. */
export const parseScreenshotTimestamp = (screenshotPath: string): number => {
  const match = screenshotPath.match(/\/(\d+)_\d+x\d+\.jpg$/);

  if (!match) {
    throw new Error(
      `screenshot path has no encoded timestamp: ${screenshotPath}`,
    );
  }

  return Number(match[1]);
};
