import { upsertTitleCard } from '@abbottland/video-db';
import type { TitleCard, VideoJob } from '@abbottland/video-db';
import { insertEpisodeTitleCards } from '../../src/worker/operations/paw-patrol-title-cards/steps/insert-episode-title-cards';
import { JobProcessingError } from '../../src/worker/job-processing-error';
import type { PawPatrolTitleCardsContext } from '../../src/worker/operations/paw-patrol-title-cards/context';

jest.mock('@abbottland/video-db', () => ({
  upsertTitleCard: jest.fn(),
}));
jest.mock('../../src/db', () => ({ db: {} }));

const buildContext = (
  overrides: Partial<PawPatrolTitleCardsContext> = {},
): PawPatrolTitleCardsContext => ({
  job: {} as VideoJob,
  seasonNumber: 3,
  episodes: [],
  outputPaths: [],
  message: '',
  ...overrides,
});

const buildTitleCard = (overrides: Partial<TitleCard> = {}): TitleCard => ({
  id: 'tc-1',
  fileHash: 'hash-1',
  filePath: 'Paw Patrol/Season 3/e01.mp4',
  timestampSeconds: 45,
  runTimeSeconds: 600,
  title: 'Pups Save a Blimp',
  screenshotPath: 'screenshots/Paw Patrol/Season 3/hash-1/45_480x270.jpg',
  createdAt: new Date(),
  ...overrides,
});

describe('insertEpisodeTitleCards', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('skips episodes that already have title_cards records', async () => {
    const existingTitleCard = buildTitleCard();
    const context = buildContext({
      episodes: [
        {
          filename: 'e01.mp4',
          absPath: '/media/e01.mp4',
          hash: 'hash-1',
          titleCards: [existingTitleCard],
        },
      ],
    });

    const result = await insertEpisodeTitleCards(context);

    expect(result.episodes[0].titleCards).toEqual([existingTitleCard]);
    expect(upsertTitleCard).not.toHaveBeenCalled();
  });

  it('rejects an episode with no detections yet', async () => {
    const context = buildContext({
      episodes: [
        {
          filename: 'e01.mp4',
          absPath: '/media/e01.mp4',
          hash: 'hash-1',
          titleCards: [],
          runTimeSeconds: 600,
        },
      ],
    });

    await expect(insertEpisodeTitleCards(context)).rejects.toThrow(
      JobProcessingError,
    );
  });

  it('writes nothing for an episode where no detection found a title', async () => {
    const context = buildContext({
      episodes: [
        {
          filename: 'e01.mp4',
          absPath: '/media/e01.mp4',
          hash: 'hash-1',
          titleCards: [],
          runTimeSeconds: 600,
          titleCardDetections: [
            {
              screenshotPath: 'screenshots/x/31_480x270.jpg',
              timestampSeconds: 31,
              found: false,
            },
          ],
        },
      ],
    });

    const result = await insertEpisodeTitleCards(context);

    expect(upsertTitleCard).not.toHaveBeenCalled();
    expect(result.episodes[0].titleCards).toEqual([]);
  });

  it('writes one row per distinct title, keeping the earliest timestamp and dropping duplicates', async () => {
    (upsertTitleCard as jest.Mock).mockImplementation((_db, input) =>
      Promise.resolve(buildTitleCard(input)),
    );

    const context = buildContext({
      seasonNumber: 3,
      episodes: [
        {
          filename: 'Paw Patrol - S03E01 - Pups Save a Blimp.mp4',
          absPath: '/media/e01.mp4',
          hash: 'hash-1',
          titleCards: [],
          runTimeSeconds: 600,
          titleCardDetections: [
            {
              screenshotPath: 'screenshots/x/31_480x270.jpg',
              timestampSeconds: 31,
              found: false,
            },
            {
              screenshotPath: 'screenshots/x/51_480x270.jpg',
              timestampSeconds: 51,
              found: true,
              title: 'Pups Save a Blimp',
            },
            {
              screenshotPath: 'screenshots/x/53_480x270.jpg',
              timestampSeconds: 53,
              found: true,
              title: 'Pups Save a Blimp',
            },
          ],
        },
      ],
    });

    const result = await insertEpisodeTitleCards(context);

    expect(upsertTitleCard).toHaveBeenCalledTimes(1);
    expect(upsertTitleCard).toHaveBeenCalledWith(
      {},
      {
        fileHash: 'hash-1',
        filePath:
          'media/tv_shows/Paw Patrol/Season 3/Paw Patrol - S03E01 - Pups Save a Blimp.mp4',
        timestampSeconds: 51,
        runTimeSeconds: 600,
        title: 'Pups Save a Blimp',
        screenshotPath: 'screenshots/x/51_480x270.jpg',
      },
    );
    expect(result.episodes[0].titleCards).toHaveLength(1);
  });

  it('writes a separate row for each genuinely distinct title', async () => {
    (upsertTitleCard as jest.Mock).mockImplementation((_db, input) =>
      Promise.resolve(buildTitleCard(input)),
    );

    const context = buildContext({
      episodes: [
        {
          filename: 'e01.mp4',
          absPath: '/media/e01.mp4',
          hash: 'hash-1',
          titleCards: [],
          runTimeSeconds: 900,
          titleCardDetections: [
            {
              screenshotPath: 'screenshots/x/45_480x270.jpg',
              timestampSeconds: 45,
              found: true,
              title: 'Pups Save a Blimp',
            },
            {
              screenshotPath: 'screenshots/x/705_480x270.jpg',
              timestampSeconds: 705,
              found: true,
              title: 'Pups Save a Goldrush',
            },
          ],
        },
      ],
    });

    const result = await insertEpisodeTitleCards(context);

    expect(upsertTitleCard).toHaveBeenCalledTimes(2);
    expect(result.episodes[0].titleCards).toHaveLength(2);
  });
});
