export const SHOW_DIRECTORY_NAME = 'Paw Patrol';

/** `<series>/<season>`, relative to MEDIA_ROOT — e.g. `Paw Patrol/Season 3`. */
export const seasonDirectoryRelPath = (seasonNumber: number): string =>
  `${SHOW_DIRECTORY_NAME}/Season ${seasonNumber}`;
