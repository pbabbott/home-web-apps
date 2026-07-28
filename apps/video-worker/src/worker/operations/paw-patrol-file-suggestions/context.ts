import type { VideoJob } from '@abbottland/video-db';
import type { SonarrEpisode } from '../../../api/sonarr/sonarr-client';
import type { Episode } from './episode';

/**
 * Threaded through every step of the paw_patrol_file_suggestions pipeline.
 * Mirrors paw-patrol-title-cards's context shape: `episodes` is the shared
 * per-file state each step reads from and adds onto, plus `sonarrEpisodes`
 * — the season's official episode list, fetched once and shared across all
 * episodes rather than per-file.
 */
export type PawPatrolFileSuggestionsContext = {
  job: VideoJob;
  seasonNumber: number;
  episodes: Episode[];
  sonarrEpisodes: SonarrEpisode[];
  outputPaths: string[];
  message: string;
};
