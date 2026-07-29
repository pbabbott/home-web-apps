import {
  seasonDirectoryRelPath,
  SHOW_DIRECTORY_NAME,
} from '../../paw-patrol-title-cards/lib/paths';

/** Strips characters Plex/most filesystems don't allow in a filename. */
const sanitizeFilenameSegment = (value: string): string =>
  value.replace(/[\\/:*?"<>|]/g, '').trim();

/** Sonarr-style release-quality tags this library's source filenames carry, e.g. `HDTV-720p`, `WEBDL-1080p`. */
const QUALITY_TAG_PATTERN =
  /\b(?:HDTV|PDTV|SDTV|WEBDL|WEB-DL|WEBRip|WEBCap|BluRay|Bluray|BDRip|BRRip|DVDRip|DVD)-?\d{3,4}p\b/i;

/**
 * Pulls the release-quality tag out of an original filename, if present, so
 * it can be carried over to the suggested filename — nothing else in this
 * pipeline knows or cares about quality, but it's real information already
 * present in the original name that a rename shouldn't silently drop.
 */
export const extractQualityTag = (filename: string): string | null =>
  filename.match(QUALITY_TAG_PATTERN)?.[0] ?? null;

/** Formats the optional bracketed quality-tag suffix Plex treats as a matching hint, or '' if there is none. */
const qualitySuffix = (qualityTag: string | null): string =>
  qualityTag ? ` [${qualityTag}]` : '';

/**
 * Builds a Plex-standard TV episode filename:
 * `<Series> - S<season>E<episode> - <Episode Title> [<Quality>].<ext>`, e.g.
 * `Paw Patrol - S03E01 - Pups Save a Blimp [WEBDL-1080p].mp4`. The bracketed
 * quality tag is omitted when the original filename had none.
 * https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/
 */
export const buildPlexEpisodeFilename = (
  seasonNumber: number,
  episodeNumber: number,
  episodeTitle: string,
  qualityTag: string | null,
  extension: string,
): string => {
  const season = String(seasonNumber).padStart(2, '0');
  const episode = String(episodeNumber).padStart(2, '0');
  const title = sanitizeFilenameSegment(episodeTitle);

  return `${SHOW_DIRECTORY_NAME} - S${season}E${episode} - ${title}${qualitySuffix(qualityTag)}${extension}`;
};

/** MEDIA_ROOT-relative destination path for a suggested Plex-named episode file. */
export const buildPlexEpisodeRelPath = (
  seasonNumber: number,
  episodeNumber: number,
  episodeTitle: string,
  qualityTag: string | null,
  extension: string,
): string =>
  `${seasonDirectoryRelPath(seasonNumber)}/${buildPlexEpisodeFilename(
    seasonNumber,
    episodeNumber,
    episodeTitle,
    qualityTag,
    extension,
  )}`;

/**
 * Builds a Plex-standard multi-episode TV filename, for a file that bundles
 * two episodes back to back (common for this show):
 * `<Series> - S<season>E<first>-E<second> - <First Title> & <Second Title> [<Quality>].<ext>`,
 * e.g. `Paw Patrol - S03E18-E19 - Pups Save a Goldrush & Pups Save a Space Alien [HDTV-720p].mp4`.
 * https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/
 * ("ShowName – sXXeYY-eZZ – Optional_Info.ext").
 */
export const buildPlexMultiEpisodeFilename = (
  seasonNumber: number,
  firstEpisodeNumber: number,
  secondEpisodeNumber: number,
  firstEpisodeTitle: string,
  secondEpisodeTitle: string,
  qualityTag: string | null,
  extension: string,
): string => {
  const season = String(seasonNumber).padStart(2, '0');
  const first = String(firstEpisodeNumber).padStart(2, '0');
  const second = String(secondEpisodeNumber).padStart(2, '0');
  const firstTitle = sanitizeFilenameSegment(firstEpisodeTitle);
  const secondTitle = sanitizeFilenameSegment(secondEpisodeTitle);

  return `${SHOW_DIRECTORY_NAME} - S${season}E${first}-E${second} - ${firstTitle} & ${secondTitle}${qualitySuffix(qualityTag)}${extension}`;
};

/** MEDIA_ROOT-relative destination path for a suggested Plex-named multi-episode file. */
export const buildPlexMultiEpisodeRelPath = (
  seasonNumber: number,
  firstEpisodeNumber: number,
  secondEpisodeNumber: number,
  firstEpisodeTitle: string,
  secondEpisodeTitle: string,
  qualityTag: string | null,
  extension: string,
): string =>
  `${seasonDirectoryRelPath(seasonNumber)}/${buildPlexMultiEpisodeFilename(
    seasonNumber,
    firstEpisodeNumber,
    secondEpisodeNumber,
    firstEpisodeTitle,
    secondEpisodeTitle,
    qualityTag,
    extension,
  )}`;
