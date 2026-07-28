import type { FileRename, TitleCard, VideoJob } from '@abbottland/video-db';
import { suggestFilenames } from '../../src/worker/operations/paw-patrol-file-suggestions/steps/suggest-filenames';
import { suggestDoubleEpisode } from '../../src/worker/operations/paw-patrol-file-suggestions/lib/suggest-double-episode';
import { suggestSingleEpisode } from '../../src/worker/operations/paw-patrol-file-suggestions/lib/suggest-single-episode';
import type { PawPatrolFileSuggestionsContext } from '../../src/worker/operations/paw-patrol-file-suggestions/context';

jest.mock(
  '../../src/worker/operations/paw-patrol-file-suggestions/lib/suggest-single-episode',
  () => ({
    suggestSingleEpisode: jest.fn(),
  }),
);
jest.mock(
  '../../src/worker/operations/paw-patrol-file-suggestions/lib/suggest-double-episode',
  () => ({
    suggestDoubleEpisode: jest.fn(),
  }),
);

const buildContext = (
  overrides: Partial<PawPatrolFileSuggestionsContext> = {},
): PawPatrolFileSuggestionsContext => ({
  job: {} as VideoJob,
  seasonNumber: 3,
  episodes: [],
  sonarrEpisodes: [
    { seasonNumber: 3, episodeNumber: 18, title: 'Pups Save a Goldrush' },
    { seasonNumber: 3, episodeNumber: 19, title: 'Pups Save a Space Alien' },
  ],
  outputPaths: [],
  message: '',
  ...overrides,
});

describe('suggestFilenames', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('skips an episode that already has a suggestion', async () => {
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

    const result = await suggestFilenames(context);

    expect(result.episodes[0].suggestedFilePath).toBeUndefined();
    expect(suggestSingleEpisode).not.toHaveBeenCalled();
    expect(suggestDoubleEpisode).not.toHaveBeenCalled();
  });

  it('skips an episode with no title cards yet', async () => {
    const context = buildContext({
      episodes: [
        {
          filename: 'e01.mp4',
          absPath: '/media/e01.mp4',
          hash: 'hash-1',
          titleCards: [],
        },
      ],
    });

    const result = await suggestFilenames(context);

    expect(result.episodes[0].suggestedFilePath).toBeUndefined();
    expect(suggestSingleEpisode).not.toHaveBeenCalled();
    expect(suggestDoubleEpisode).not.toHaveBeenCalled();
  });

  describe('one title card (single episode)', () => {
    it('leaves suggestedFilePath unset when the AI has no confident match', async () => {
      (suggestSingleEpisode as jest.Mock).mockResolvedValue({
        found: false,
      });

      const context = buildContext({
        episodes: [
          {
            filename: 'e01.mp4',
            absPath: '/media/e01.mp4',
            hash: 'hash-1',
            titleCards: [{ title: 'Pups Save a Goldrush' } as TitleCard],
          },
        ],
      });

      const result = await suggestFilenames(context);

      expect(result.episodes[0].suggestedFilePath).toBeUndefined();
    });

    it('computes a Plex-style suggestedFilePath from a confident match', async () => {
      (suggestSingleEpisode as jest.Mock).mockResolvedValue({
        found: true,
        episodeNumber: 18,
        episodeTitle: 'Pups Save a Goldrush',
      });

      const context = buildContext({
        episodes: [
          {
            filename: 'random-name.mp4',
            absPath: '/media/random-name.mp4',
            hash: 'hash-1',
            titleCards: [{ title: 'Pups Save a Goldrush' } as TitleCard],
          },
        ],
      });

      const result = await suggestFilenames(context);

      expect(result.episodes[0].suggestedFilePath).toBe(
        'Paw Patrol/Season 3/Paw Patrol - S03E18 - Pups Save a Goldrush.mp4',
      );
      expect(suggestSingleEpisode).toHaveBeenCalledWith(
        'random-name.mp4',
        'Pups Save a Goldrush',
        context.sonarrEpisodes,
      );
      expect(suggestDoubleEpisode).not.toHaveBeenCalled();
    });
  });

  describe('two title cards (bundled double episode)', () => {
    it('leaves suggestedFilePath unset when the AI has no confident match', async () => {
      (suggestDoubleEpisode as jest.Mock).mockResolvedValue({
        found: false,
      });

      const context = buildContext({
        episodes: [
          {
            filename: 'e18-19.mp4',
            absPath: '/media/e18-19.mp4',
            hash: 'hash-1',
            titleCards: [
              { title: 'Pups Save a Goldrush' } as TitleCard,
              { title: 'Pups Save a Space Alien' } as TitleCard,
            ],
          },
        ],
      });

      const result = await suggestFilenames(context);

      expect(result.episodes[0].suggestedFilePath).toBeUndefined();
    });

    it('computes a Plex multi-episode suggestedFilePath in file order from a confident match', async () => {
      (suggestDoubleEpisode as jest.Mock).mockResolvedValue({
        found: true,
        episodes: [
          { episodeNumber: 18, episodeTitle: 'Pups Save a Goldrush' },
          { episodeNumber: 19, episodeTitle: 'Pups Save a Space Alien' },
        ],
      });

      const context = buildContext({
        episodes: [
          {
            filename: 'random-name.mp4',
            absPath: '/media/random-name.mp4',
            hash: 'hash-1',
            titleCards: [
              { title: 'Pups Save a Goldrush' } as TitleCard,
              { title: 'Pups Save a Space Alien' } as TitleCard,
            ],
          },
        ],
      });

      const result = await suggestFilenames(context);

      expect(result.episodes[0].suggestedFilePath).toBe(
        'Paw Patrol/Season 3/Paw Patrol - S03E18-E19 - Pups Save a Goldrush & Pups Save a Space Alien.mp4',
      );
      expect(suggestDoubleEpisode).toHaveBeenCalledWith(
        'random-name.mp4',
        'Pups Save a Goldrush',
        'Pups Save a Space Alien',
        context.sonarrEpisodes,
      );
      expect(suggestSingleEpisode).not.toHaveBeenCalled();
    });

    it('matches against the first two title cards when three or more are present', async () => {
      (suggestDoubleEpisode as jest.Mock).mockResolvedValue({
        found: true,
        episodes: [
          { episodeNumber: 18, episodeTitle: 'Pups Save a Goldrush' },
          { episodeNumber: 19, episodeTitle: 'Pups Save a Space Alien' },
        ],
      });

      const context = buildContext({
        episodes: [
          {
            filename: 'random-name.mp4',
            absPath: '/media/random-name.mp4',
            hash: 'hash-1',
            titleCards: [
              { title: 'Pups Save a Goldrush' } as TitleCard,
              { title: 'Pups Save a Space Alien' } as TitleCard,
              { title: 'A Third Card' } as TitleCard,
            ],
          },
        ],
      });

      await suggestFilenames(context);

      expect(suggestDoubleEpisode).toHaveBeenCalledWith(
        'random-name.mp4',
        'Pups Save a Goldrush',
        'Pups Save a Space Alien',
        context.sonarrEpisodes,
      );
    });
  });
});
