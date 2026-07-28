import type { FileRename, VideoJob } from '@abbottland/video-db';
import {
  getSeasonEpisodes,
  getSeriesByTitle,
} from '../../src/api/sonarr/sonarr-client';
import { fetchSonarrEpisodes } from '../../src/worker/operations/paw-patrol-file-suggestions/steps/fetch-sonarr-episodes';
import type { PawPatrolFileSuggestionsContext } from '../../src/worker/operations/paw-patrol-file-suggestions/context';

jest.mock('../../src/api/sonarr/sonarr-client', () => ({
  getSeriesByTitle: jest.fn(),
  getSeasonEpisodes: jest.fn(),
}));

const buildContext = (
  overrides: Partial<PawPatrolFileSuggestionsContext> = {},
): PawPatrolFileSuggestionsContext => ({
  job: {} as VideoJob,
  seasonNumber: 3,
  episodes: [],
  sonarrEpisodes: [],
  outputPaths: [],
  message: '',
  ...overrides,
});

describe('fetchSonarrEpisodes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('skips the Sonarr calls when every episode already has a suggestion', async () => {
    const context = buildContext({
      episodes: [
        {
          filename: 'e01.mp4',
          absPath: '/media/e01.mp4',
          hash: 'hash-1',
          existingSuggestion: { id: 'fr-1' } as FileRename,
        },
      ],
    });

    const result = await fetchSonarrEpisodes(context);

    expect(result.sonarrEpisodes).toEqual([]);
    expect(getSeriesByTitle).not.toHaveBeenCalled();
    expect(getSeasonEpisodes).not.toHaveBeenCalled();
  });

  it('fetches Paw Patrol by title then the season episode list', async () => {
    (getSeriesByTitle as jest.Mock).mockResolvedValue({
      id: 7,
      title: 'Paw Patrol',
    });
    (getSeasonEpisodes as jest.Mock).mockResolvedValue([
      { seasonNumber: 3, episodeNumber: 1, title: 'Pups Save a Blimp' },
    ]);

    const context = buildContext({
      episodes: [
        { filename: 'e01.mp4', absPath: '/media/e01.mp4', hash: 'hash-1' },
      ],
    });

    const result = await fetchSonarrEpisodes(context);

    expect(getSeriesByTitle).toHaveBeenCalledWith('Paw Patrol');
    expect(getSeasonEpisodes).toHaveBeenCalledWith(7, 3);
    expect(result.sonarrEpisodes).toEqual([
      { seasonNumber: 3, episodeNumber: 1, title: 'Pups Save a Blimp' },
    ]);
  });
});
