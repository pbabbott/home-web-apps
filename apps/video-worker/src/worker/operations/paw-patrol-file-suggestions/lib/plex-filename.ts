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
