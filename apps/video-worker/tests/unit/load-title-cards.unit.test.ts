import { listTitleCards } from '@abbottland/video-db';
import type { FileRename, TitleCard, VideoJob } from '@abbottland/video-db';
import { loadTitleCards } from '../../src/worker/operations/paw-patrol-file-suggestions/steps/load-title-cards';
import { JobProcessingError } from '../../src/worker/job-processing-error';
import type { PawPatrolFileSuggestionsContext } from '../../src/worker/operations/paw-patrol-file-suggestions/context';

jest.mock('@abbottland/video-db', () => ({
  listTitleCards: jest.fn(),
}));
jest.mock('../../src/db', () => ({ db: {} }));

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

describe('loadTitleCards', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('skips an episode that already has an existingSuggestion', async () => {
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

    const result = await loadTitleCards(context);

    expect(result.episodes[0].titleCards).toBeUndefined();
    expect(listTitleCards).not.toHaveBeenCalled();
  });

  it('rejects an episode with no hash and no existingSuggestion', async () => {
    const context = buildContext({
      episodes: [{ filename: 'e01.mp4', absPath: '/media/e01.mp4' }],
    });

    await expect(loadTitleCards(context)).rejects.toThrow(JobProcessingError);
  });

  it('loads title_cards rows for an episode still needing a suggestion', async () => {
    const titleCards = [
      { id: 'tc-1', title: 'Pups Save a Blimp' },
    ] as TitleCard[];
    (listTitleCards as jest.Mock).mockResolvedValue(titleCards);

    const context = buildContext({
      episodes: [
        { filename: 'e01.mp4', absPath: '/media/e01.mp4', hash: 'hash-1' },
      ],
    });

    const result = await loadTitleCards(context);

    expect(result.episodes[0].titleCards).toEqual(titleCards);
    expect(listTitleCards).toHaveBeenCalledWith({}, { fileHash: 'hash-1' });
  });
});
