import { hashFile } from '@abbottland/video-db';
import type { VideoJob } from '@abbottland/video-db';
import { hashEpisodeFiles } from '../../src/worker/operations/paw-patrol-title-cards/steps/hash-episode-files';
import type { PawPatrolTitleCardsContext } from '../../src/worker/operations/paw-patrol-title-cards/context';

jest.mock('@abbottland/video-db', () => ({
  hashFile: jest.fn(),
}));

const buildContext = (
  overrides: Partial<PawPatrolTitleCardsContext> = {},
): PawPatrolTitleCardsContext => ({
  job: {} as VideoJob,
  seasonNumber: 3,
  model: 'test-model',
  episodes: [],
  outputPaths: [],
  message: '',
  ...overrides,
});

describe('hashEpisodeFiles', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('adds a hash to each episode, keyed by its absPath', async () => {
    (hashFile as jest.Mock).mockImplementation((absPath: string) =>
      Promise.resolve(`hash-of-${absPath}`),
    );

    const context = buildContext({
      episodes: [
        { filename: 'e01.mp4', absPath: '/media/Season 3/e01.mp4' },
        { filename: 'e02.mp4', absPath: '/media/Season 3/e02.mp4' },
      ],
    });

    const result = await hashEpisodeFiles(context);

    expect(result.episodes).toEqual([
      {
        filename: 'e01.mp4',
        absPath: '/media/Season 3/e01.mp4',
        hash: 'hash-of-/media/Season 3/e01.mp4',
      },
      {
        filename: 'e02.mp4',
        absPath: '/media/Season 3/e02.mp4',
        hash: 'hash-of-/media/Season 3/e02.mp4',
      },
    ]);
  });

  it('leaves an empty episode list unchanged', async () => {
    const context = buildContext();

    const result = await hashEpisodeFiles(context);

    expect(result.episodes).toEqual([]);
    expect(hashFile).not.toHaveBeenCalled();
  });
});
