import type { Series, VideoJob } from '@abbottland/video-db';
import type { SonarrEpisode } from '../../../api/sonarr/sonarr-client';
import type { Episode } from './episode';

/**
 * Threaded through every step of the file_suggestions pipeline. Mirrors
 * title-cards's context shape: `episodes` is the shared per-file
 * state each step reads from and adds onto, plus `sonarrEpisodes` — the
 * season's official episode list, fetched once and shared across all
 * episodes rather than per-file.
 */
export type FileSuggestionsContext = {
  job: VideoJob;
  /** Resolved from job.parameters.series — carries the on-disk directory name (which may differ from the display name) and the id to stamp onto written file_renames rows. */
  series: Series;
  seasonNumber: number;
  /** AI model for episode-matching calls — job.parameters.model, falling back to config.aiModel. */
  model: string;
  episodes: Episode[];
  sonarrEpisodes: SonarrEpisode[];
  message: string;
};
