import type { VideoJob } from '@abbottland/video-db';
import type { Episode } from './episode';

/**
 * Threaded through every step of the paw_patrol_title_cards pipeline. Every
 * step in this operation is ultimately about building up per-episode (or
 * whole-season) metadata, so `episodes` is the shared object each step
 * reads from and adds onto — e.g. hash, detected title-card timestamps.
 */
export type PawPatrolTitleCardsContext = {
  job: VideoJob;
  seasonNumber: number;
  episodes: Episode[];
  outputPaths: string[];
  message: string;
};
