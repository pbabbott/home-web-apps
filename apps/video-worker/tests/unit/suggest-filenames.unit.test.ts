import type { FileRename, TitleCard, VideoJob } from '@abbottland/video-db';
import { suggestFilenames } from '../../src/worker/operations/paw-patrol-file-suggestions/steps/suggest-filenames';
import { suggestEpisode } from '../../src/worker/operations/paw-patrol-file-suggestions/lib/suggest-episode';
import type { PawPatrolFileSuggestionsContext } from '../../src/worker/operations/paw-patrol-file-suggestions/context';

jest.mock(
  '../../src/worker/operations/paw-patrol-file-suggestions/lib/suggest-episode',
  () => ({
    suggestEpisode: jest.fn(),
  }),
);

const buildContext = (
  overrides: Partial<PawPatrolFileSuggestionsContext> = {},
): PawPatrolFileSuggestionsContext => ({
  job: {} as VideoJob,
  seasonNumber: 3,
  episodes: [],
  sonarrEpisodes: [
    { seasonNumber: 3, episodeNumber: 1, title: 'Pups Save a Blimp' },
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
    expect(suggestEpisode).not.toHaveBeenCalled();
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
    expect(suggestEpisode).not.toHaveBeenCalled();
  });

  it('leaves suggestedFilePath unset when the AI has no confident match', async () => {
    (suggestEpisode as jest.Mock).mockResolvedValue({ found: false });

    const context = buildContext({
      episodes: [
        {
          filename: 'e01.mp4',
          absPath: '/media/e01.mp4',
          hash: 'hash-1',
          titleCards: [{ title: 'Pups Save a Blimp' } as TitleCard],
        },
      ],
    });

    const result = await suggestFilenames(context);

    expect(result.episodes[0].suggestedFilePath).toBeUndefined();
  });

  it('computes a Plex-style suggestedFilePath from a confident match', async () => {
    (suggestEpisode as jest.Mock).mockResolvedValue({
      found: true,
      episodeNumber: 1,
      episodeTitle: 'Pups Save a Blimp',
    });

    const context = buildContext({
      episodes: [
        {
          filename: 'random-name.mp4',
          absPath: '/media/random-name.mp4',
          hash: 'hash-1',
          titleCards: [{ title: 'Pups Save a Blimp' } as TitleCard],
        },
      ],
    });

    const result = await suggestFilenames(context);

    expect(result.episodes[0].suggestedFilePath).toBe(
      'Paw Patrol/Season 3/Paw Patrol - S03E01 - Pups Save a Blimp.mp4',
    );
    expect(suggestEpisode).toHaveBeenCalledWith(
      'random-name.mp4',
      ['Pups Save a Blimp'],
      context.sonarrEpisodes,
    );
  });
});
