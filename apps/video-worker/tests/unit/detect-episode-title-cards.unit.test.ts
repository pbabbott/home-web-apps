import fs from 'fs';
import type { TitleCard, VideoJob } from '@abbottland/video-db';
import { detectEpisodeTitleCards } from '../../src/worker/operations/paw-patrol-title-cards/steps/detect-episode-title-cards';
import { detectTitleCard } from '../../src/worker/operations/paw-patrol-title-cards/lib/detect-title-card';
import { JobProcessingError } from '../../src/worker/job-processing-error';
import type { PawPatrolTitleCardsContext } from '../../src/worker/operations/paw-patrol-title-cards/context';

jest.mock('fs');
jest.mock('../../src/config', () => ({
  config: { mediaRoot: '/media' },
}));
jest.mock(
  '../../src/worker/operations/paw-patrol-title-cards/lib/detect-title-card',
  () => ({
    detectTitleCard: jest.fn(),
  }),
);

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

const buildTitleCard = (overrides: Partial<TitleCard> = {}): TitleCard => ({
  id: 'tc-1',
  fileHash: 'hash-1',
  filePath: '/media/e01.mp4',
  timestampSeconds: 30,
  runTimeSeconds: 600,
  title: 'Pups Save a Blimp',
  screenshotPath: null,
  screenshotBase64: null,
  createdAt: new Date(),
  ...overrides,
});

describe('detectEpisodeTitleCards', () => {
  beforeEach(() => {
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('jpegbytes'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('skips episodes that already have title_cards records', async () => {
    const context = buildContext({
      episodes: [
        {
          filename: 'e01.mp4',
          absPath: '/media/e01.mp4',
          hash: 'hash-1',
          titleCards: [buildTitleCard()],
        },
      ],
    });

    const result = await detectEpisodeTitleCards(context);

    expect(result.episodes[0].titleCardDetections).toBeUndefined();
    expect(detectTitleCard).not.toHaveBeenCalled();
  });

  it('rejects an episode with no screenshots yet', async () => {
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

    await expect(detectEpisodeTitleCards(context)).rejects.toThrow(
      JobProcessingError,
    );
  });

  it('checks every screenshot sequentially and records each detection', async () => {
    (detectTitleCard as jest.Mock)
      .mockResolvedValueOnce({ found: false })
      .mockResolvedValueOnce({ found: true, title: 'Pups Save a Blimp' })
      .mockResolvedValueOnce({ found: false });

    const context = buildContext({
      episodes: [
        {
          filename: 'e01.mp4',
          absPath: '/media/e01.mp4',
          hash: 'hash-1',
          titleCards: [],
          screenshotPaths: [
            'screenshots/Paw Patrol/Season 3/hash-1/31_480x270.jpg',
            'screenshots/Paw Patrol/Season 3/hash-1/45_480x270.jpg',
            'screenshots/Paw Patrol/Season 3/hash-1/59_480x270.jpg',
          ],
        },
      ],
    });

    const result = await detectEpisodeTitleCards(context);

    expect(detectTitleCard).toHaveBeenCalledTimes(3);
    expect(detectTitleCard).toHaveBeenNthCalledWith(
      2,
      'screenshots/Paw Patrol/Season 3/hash-1/45_480x270.jpg',
      Buffer.from('jpegbytes').toString('base64'),
      'image/jpeg',
      'test-model',
    );

    const screenshotBase64 = Buffer.from('jpegbytes').toString('base64');

    expect(result.episodes[0].titleCardDetections).toEqual([
      {
        screenshotPath: 'screenshots/Paw Patrol/Season 3/hash-1/31_480x270.jpg',
        screenshotBase64,
        timestampSeconds: 31,
        found: false,
      },
      {
        screenshotPath: 'screenshots/Paw Patrol/Season 3/hash-1/45_480x270.jpg',
        screenshotBase64,
        timestampSeconds: 45,
        found: true,
        title: 'Pups Save a Blimp',
      },
      {
        screenshotPath: 'screenshots/Paw Patrol/Season 3/hash-1/59_480x270.jpg',
        screenshotBase64,
        timestampSeconds: 59,
        found: false,
      },
    ]);
  });
});
