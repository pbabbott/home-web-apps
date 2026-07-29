import { upsertFileRename } from '@abbottland/video-db';
import type { FileRename, VideoJob } from '@abbottland/video-db';
import { saveSuggestions } from '../../src/worker/operations/paw-patrol-file-suggestions/steps/save-suggestions';
import { JobProcessingError } from '../../src/worker/job-processing-error';
import type { PawPatrolFileSuggestionsContext } from '../../src/worker/operations/paw-patrol-file-suggestions/context';

jest.mock('@abbottland/video-db', () => ({
  upsertFileRename: jest.fn(),
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

describe('saveSuggestions', () => {
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

    const result = await saveSuggestions(context);

    expect(upsertFileRename).not.toHaveBeenCalled();
    expect(result.outputPaths).toEqual([]);
  });

  it('skips an episode with no computed suggestedFilePath', async () => {
    const context = buildContext({
      episodes: [
        { filename: 'e01.mp4', absPath: '/media/e01.mp4', hash: 'hash-1' },
      ],
    });

    const result = await saveSuggestions(context);

    expect(upsertFileRename).not.toHaveBeenCalled();
    expect(result.outputPaths).toEqual([]);
  });

  it('rejects an episode with a suggestion but no hash', async () => {
    const context = buildContext({
      episodes: [
        {
          filename: 'e01.mp4',
          absPath: '/media/e01.mp4',
          suggestedFilePath: 'Paw Patrol/Season 3/x.mp4',
        },
      ],
    });

    await expect(saveSuggestions(context)).rejects.toThrow(JobProcessingError);
  });

  it('upserts a file_renames row and records the output path', async () => {
    (upsertFileRename as jest.Mock).mockResolvedValue({});

    const context = buildContext({
      seasonNumber: 3,
      episodes: [
        {
          filename: 'random-name.mp4',
          absPath: '/media/random-name.mp4',
          hash: 'hash-1',
          suggestedFilePath:
            'Paw Patrol/Season 3/Paw Patrol - S03E01 - Pups Save a Blimp.mp4',
          sourceTitleCardTitles: ['Pups Save a Blimp'],
        },
      ],
    });

    const result = await saveSuggestions(context);

    expect(upsertFileRename).toHaveBeenCalledWith(
      {},
      {
        fileHash: 'hash-1',
        originalFilePath: 'Paw Patrol/Season 3/random-name.mp4',
        suggestedFilePath:
          'Paw Patrol/Season 3/Paw Patrol - S03E01 - Pups Save a Blimp.mp4',
        sourceTitleCardTitles: ['Pups Save a Blimp'],
      },
    );
    expect(result.outputPaths).toEqual([
      'Paw Patrol/Season 3/Paw Patrol - S03E01 - Pups Save a Blimp.mp4',
    ]);
  });
});
