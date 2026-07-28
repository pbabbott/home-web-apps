import { config } from '../../config';

export type SonarrSeries = {
  id: number;
  title: string;
};

export type SonarrEpisode = {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
};

type RawSonarrEpisode = {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
};

const request = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${config.sonarr.apiUrl}${path}`, {
    headers: { 'X-Api-Key': config.sonarr.apiKey },
  });

  if (!response.ok) {
    throw new Error(
      `Sonarr API request failed: ${response.status} ${await response.text()}`,
    );
  }

  return (await response.json()) as T;
};

/**
 * Looks up a series by its exact title. Sonarr has no "get by title"
 * endpoint, so this fetches the whole series list and matches client-side —
 * fine for a handful of shows, and avoids needing a series ID in config.
 */
export const getSeriesByTitle = async (
  title: string,
): Promise<SonarrSeries> => {
  const series = await request<SonarrSeries[]>('/api/v3/series');
  const match = series.find((s) => s.title === title);

  if (!match) {
    throw new Error(`Sonarr has no series titled "${title}"`);
  }

  return match;
};

/** Full episode list (number + official title) for one season of a series. */
export const getSeasonEpisodes = async (
  seriesId: number,
  seasonNumber: number,
): Promise<SonarrEpisode[]> => {
  const episodes = await request<RawSonarrEpisode[]>(
    `/api/v3/episode?seriesId=${seriesId}&seasonNumber=${seasonNumber}`,
  );

  return episodes.map((episode) => ({
    seasonNumber: episode.seasonNumber,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
  }));
};
