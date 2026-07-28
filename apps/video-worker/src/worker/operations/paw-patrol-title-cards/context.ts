import type { VideoJob } from '@abbottland/video-db';

/**
 * Threaded through every step of the paw_patrol_title_cards pipeline.
 * Extend this as steps are added — e.g. a resolved season directory, the
 * list of episode files, detected title-card timestamps.
 */
export type PawPatrolTitleCardsContext = {
  job: VideoJob;
  seasonNumber: number;
  outputPaths: string[];
  message: string;
};
