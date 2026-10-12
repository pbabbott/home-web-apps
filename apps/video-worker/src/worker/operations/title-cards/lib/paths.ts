export const SHOW_DIRECTORY_NAME = 'Paw Patrol';
const TV_SHOWS_DIRECTORY_NAME = 'media/tv_shows';
const SCREENSHOTS_DIRECTORY_NAME = 'screenshots';

/** `<series>/<season>`, e.g. `Paw Patrol/Season 3` — shared by the tv_shows and screenshots subtrees below. */
const showSeasonRelPath = (seasonNumber: number): string =>
  `${SHOW_DIRECTORY_NAME}/Season ${seasonNumber}`;

/** `media/tv_shows/<series>/<season>`, relative to MEDIA_ROOT — e.g. `media/tv_shows/Paw Patrol/Season 3`. */
export const seasonDirectoryRelPath = (seasonNumber: number): string =>
  `${TV_SHOWS_DIRECTORY_NAME}/${showSeasonRelPath(seasonNumber)}`;

/**
 * `screenshots/<series>/<season>/<fileHash>`, relative to MEDIA_ROOT — kept
 * out of the tv_shows subtree entirely (not just the episode directories)
 * so generated screenshots never mix in with source video files.
 */
export const screenshotDirectoryRelPath = (
  seasonNumber: number,
  fileHash: string,
): string =>
  `${SCREENSHOTS_DIRECTORY_NAME}/${showSeasonRelPath(seasonNumber)}/${fileHash}`;

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
