const TV_SHOWS_DIRECTORY_NAME = 'media/tv_shows';
const SCREENSHOTS_DIRECTORY_NAME = 'screenshots';

/** `<directoryName>/<season>`, e.g. `Paw Patrol/Season 3` — shared by the tv_shows and screenshots subtrees below. directoryName is the series' on-disk folder name (series.directoryName), which may differ from its display name. */
const showSeasonRelPath = (
  directoryName: string,
  seasonNumber: number,
): string => `${directoryName}/Season ${seasonNumber}`;

/** `media/tv_shows/<directoryName>/<season>`, relative to MEDIA_ROOT — e.g. `media/tv_shows/Paw Patrol/Season 3`. */
export const seasonDirectoryRelPath = (
  directoryName: string,
  seasonNumber: number,
): string =>
  `${TV_SHOWS_DIRECTORY_NAME}/${showSeasonRelPath(directoryName, seasonNumber)}`;

/**
 * `screenshots/<directoryName>/<season>/<fileHash>`, relative to
 * MEDIA_ROOT — kept out of the tv_shows subtree entirely (not just the
 * episode directories) so generated screenshots never mix in with source
 * video files.
 */
export const screenshotDirectoryRelPath = (
  directoryName: string,
  seasonNumber: number,
  fileHash: string,
): string =>
  `${SCREENSHOTS_DIRECTORY_NAME}/${showSeasonRelPath(directoryName, seasonNumber)}/${fileHash}`;

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
