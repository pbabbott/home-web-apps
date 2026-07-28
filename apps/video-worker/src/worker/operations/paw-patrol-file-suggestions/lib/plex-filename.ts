import {
  seasonDirectoryRelPath,
  SHOW_DIRECTORY_NAME,
} from '../../paw-patrol-title-cards/lib/paths';

/** Strips characters Plex/most filesystems don't allow in a filename. */
const sanitizeFilenameSegment = (value: string): string =>
  value.replace(/[\\/:*?"<>|]/g, '').trim();

/**
 * Builds a Plex-standard TV episode filename:
 * `<Series> - S<season>E<episode> - <Episode Title>.<ext>`, e.g.
 * `Paw Patrol - S03E01 - Pups Save a Blimp.mp4`.
 * https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/
 */
export const buildPlexEpisodeFilename = (
  seasonNumber: number,
  episodeNumber: number,
  episodeTitle: string,
  extension: string,
): string => {
  const season = String(seasonNumber).padStart(2, '0');
  const episode = String(episodeNumber).padStart(2, '0');
  const title = sanitizeFilenameSegment(episodeTitle);

  return `${SHOW_DIRECTORY_NAME} - S${season}E${episode} - ${title}${extension}`;
};

/** MEDIA_ROOT-relative destination path for a suggested Plex-named episode file. */
export const buildPlexEpisodeRelPath = (
  seasonNumber: number,
  episodeNumber: number,
  episodeTitle: string,
  extension: string,
): string =>
  `${seasonDirectoryRelPath(seasonNumber)}/${buildPlexEpisodeFilename(
    seasonNumber,
    episodeNumber,
    episodeTitle,
    extension,
  )}`;

/**
 * Builds a Plex-standard multi-episode TV filename, for a file that bundles
 * two episodes back to back (common for this show):
 * `<Series> - S<season>E<first>-E<second> - <First Title> & <Second Title>.<ext>`,
 * e.g. `Paw Patrol - S03E18-E19 - Pups Save a Goldrush & Pups Save a Space Alien.mp4`.
 * https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/
 * ("ShowName – sXXeYY-eZZ – Optional_Info.ext").
 */
export const buildPlexMultiEpisodeFilename = (
  seasonNumber: number,
  firstEpisodeNumber: number,
  secondEpisodeNumber: number,
  firstEpisodeTitle: string,
  secondEpisodeTitle: string,
  extension: string,
): string => {
  const season = String(seasonNumber).padStart(2, '0');
  const first = String(firstEpisodeNumber).padStart(2, '0');
  const second = String(secondEpisodeNumber).padStart(2, '0');
  const firstTitle = sanitizeFilenameSegment(firstEpisodeTitle);
  const secondTitle = sanitizeFilenameSegment(secondEpisodeTitle);

  return `${SHOW_DIRECTORY_NAME} - S${season}E${first}-E${second} - ${firstTitle} & ${secondTitle}${extension}`;
};

/** MEDIA_ROOT-relative destination path for a suggested Plex-named multi-episode file. */
export const buildPlexMultiEpisodeRelPath = (
  seasonNumber: number,
  firstEpisodeNumber: number,
  secondEpisodeNumber: number,
  firstEpisodeTitle: string,
  secondEpisodeTitle: string,
  extension: string,
): string =>
  `${seasonDirectoryRelPath(seasonNumber)}/${buildPlexMultiEpisodeFilename(
    seasonNumber,
    firstEpisodeNumber,
    secondEpisodeNumber,
    firstEpisodeTitle,
    secondEpisodeTitle,
    extension,
  )}`;
