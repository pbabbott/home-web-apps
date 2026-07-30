import { listFileRenames } from '@abbottland/video-db';
import type { FileRename, VideoJob } from '@abbottland/video-db';
import { checkExistingSuggestions } from '../../src/worker/operations/paw-patrol-file-suggestions/steps/check-existing-suggestions';
import { JobProcessingError } from '../../src/worker/job-processing-error';
import type { PawPatrolFileSuggestionsContext } from '../../src/worker/operations/paw-patrol-file-suggestions/context';

jest.mock('@abbottland/video-db', () => ({
  listFileRenames: jest.fn(),
}));
jest.mock('../../src/db', () => ({ db: {} }));

const buildContext = (
  overrides: Partial<PawPatrolFileSuggestionsContext> = {},
): PawPatrolFileSuggestionsContext => ({
  job: {} as VideoJob,
  seasonNumber: 3,
  model: 'test-model',
  episodes: [],
  sonarrEpisodes: [],
  outputPaths: [],
  message: '',
  ...overrides,
});

describe('checkExistingSuggestions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an episode with no hash yet', async () => {
    const context = buildContext({
      episodes: [{ filename: 'e01.mp4', absPath: '/media/e01.mp4' }],
    });

    await expect(checkExistingSuggestions(context)).rejects.toThrow(
      JobProcessingError,
    );
  });

  it('attaches an existing file_renames row for an episode that has one', async () => {
    const existing = { id: 'fr-1', fileHash: 'hash-1' } as FileRename;
    (listFileRenames as jest.Mock).mockResolvedValue([existing]);

    const context = buildContext({
      episodes: [
        { filename: 'e01.mp4', absPath: '/media/e01.mp4', hash: 'hash-1' },
      ],
    });

    const result = await checkExistingSuggestions(context);

    expect(result.episodes[0].existingSuggestion).toEqual(existing);
    expect(listFileRenames).toHaveBeenCalledWith({}, { fileHash: 'hash-1' });
  });

  it('leaves existingSuggestion undefined for an episode with none', async () => {
    (listFileRenames as jest.Mock).mockResolvedValue([]);

    const context = buildContext({
      episodes: [
        { filename: 'e02.mp4', absPath: '/media/e02.mp4', hash: 'hash-2' },
      ],
    });

    const result = await checkExistingSuggestions(context);

    expect(result.episodes[0].existingSuggestion).toBeUndefined();
  });
});
