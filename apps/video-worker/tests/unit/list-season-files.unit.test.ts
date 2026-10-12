import fs from 'fs';
import type { Series, VideoJob } from '@abbottland/video-db';
import { listSeasonFiles } from '../../src/worker/operations/title-cards/steps/list-season-files';
import { JobProcessingError } from '../../src/worker/job-processing-error';
import type { TitleCardsContext } from '../../src/worker/operations/title-cards/context';

jest.mock('fs');
jest.mock('../../src/config', () => ({
  config: { mediaRoot: '/media' },
}));

const testSeries: Series = {
  id: 'series-1',
  seriesName: 'Paw Patrol',
  directoryName: 'Paw Patrol',
  seasonCount: 13,
  createdAt: new Date(),
};

const buildContext = (
  overrides: Partial<TitleCardsContext> = {},
): TitleCardsContext => ({
  job: {} as VideoJob,
  series: testSeries,
  seasonNumber: 3,
  model: 'test-model',
  episodes: [],
  ...overrides,
});

const direntFor = (name: string, isFile: boolean) =>
  ({ name, isFile: () => isFile }) as fs.Dirent;

describe('listSeasonFiles', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a season directory that does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    await expect(listSeasonFiles(buildContext())).rejects.toThrow(
      JobProcessingError,
    );
  });

  it('rejects a season "directory" that is actually a file', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => false });

    await expect(listSeasonFiles(buildContext())).rejects.toThrow(
      JobProcessingError,
    );
  });

  it('lists only files (not subdirectories) in the season directory', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
    (fs.readdirSync as jest.Mock).mockReturnValue([
      direntFor('Paw Patrol - S03E01 - Pups Save a Blimp.mp4', true),
      direntFor('Paw Patrol - S03E02 - Pups Save a Goldrush.mp4', true),
      direntFor('subtitles', false),
    ]);

    const result = await listSeasonFiles(buildContext({ seasonNumber: 3 }));

    expect(result.episodes).toEqual([
      {
        filename: 'Paw Patrol - S03E01 - Pups Save a Blimp.mp4',
        absPath:
          '/media/media/tv_shows/Paw Patrol/Season 3/Paw Patrol - S03E01 - Pups Save a Blimp.mp4',
      },
      {
        filename: 'Paw Patrol - S03E02 - Pups Save a Goldrush.mp4',
        absPath:
          '/media/media/tv_shows/Paw Patrol/Season 3/Paw Patrol - S03E02 - Pups Save a Goldrush.mp4',
      },
    ]);
    expect(fs.readdirSync).toHaveBeenCalledWith(
      '/media/media/tv_shows/Paw Patrol/Season 3',
      {
        withFileTypes: true,
      },
    );
  });
});
