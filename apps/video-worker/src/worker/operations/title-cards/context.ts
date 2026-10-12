import type { Series, VideoJob } from '@abbottland/video-db';
import type { Episode } from './episode';

/**
 * Threaded through every step of the title_cards pipeline. Every step in
 * this operation is ultimately about building up per-episode (or
 * whole-season) metadata, so `episodes` is the shared object each step
 * reads from and adds onto — e.g. hash, detected title-card timestamps.
 */
export type TitleCardsContext = {
  job: VideoJob;
  /** Resolved from job.parameters.series — carries the on-disk directory name (which may differ from the display name) and the id to stamp onto written title_cards rows. */
  series: Series;
  seasonNumber: number;
  /** AI model for title-card detection calls — job.parameters.model, falling back to config.aiModel. */
  model: string;
  episodes: Episode[];
};
