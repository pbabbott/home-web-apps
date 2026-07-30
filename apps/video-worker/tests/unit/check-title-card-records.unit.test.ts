import { listTitleCards } from '@abbottland/video-db';
import type { TitleCard, VideoJob } from '@abbottland/video-db';
import { checkTitleCardRecords } from '../../src/worker/operations/paw-patrol-title-cards/steps/check-title-card-records';
import { JobProcessingError } from '../../src/worker/job-processing-error';
import type { PawPatrolTitleCardsContext } from '../../src/worker/operations/paw-patrol-title-cards/context';

jest.mock('@abbottland/video-db', () => ({
  listTitleCards: jest.fn(),
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

describe('checkTitleCardRecords', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an episode with no hash yet', async () => {
    const context = buildContext({
      episodes: [{ filename: 'e01.mp4', absPath: '/media/e01.mp4' }],
    });

    await expect(checkTitleCardRecords(context)).rejects.toThrow(
      JobProcessingError,
    );
  });

  it('attaches existing title_cards rows to an episode that has them', async () => {
    const existing: TitleCard[] = [
      {
        id: 'tc-1',
        fileHash: 'hash-1',
        filePath: '/media/e01.mp4',
        timestampSeconds: 30,
        runTimeSeconds: 600,
        title: 'Pups Save a Blimp',
        screenshotPath: null,
        screenshotBase64: null,
        createdAt: new Date(),
      },
    ];
    (listTitleCards as jest.Mock).mockResolvedValue(existing);

    const context = buildContext({
      episodes: [
        { filename: 'e01.mp4', absPath: '/media/e01.mp4', hash: 'hash-1' },
      ],
    });

    const result = await checkTitleCardRecords(context);

    expect(result.episodes).toEqual([
      {
        filename: 'e01.mp4',
        absPath: '/media/e01.mp4',
        hash: 'hash-1',
        titleCards: existing,
      },
    ]);
    expect(listTitleCards).toHaveBeenCalledWith({}, { fileHash: 'hash-1' });
  });

  it('attaches an empty array for an episode with no existing records', async () => {
    (listTitleCards as jest.Mock).mockResolvedValue([]);

    const context = buildContext({
      episodes: [
        { filename: 'e02.mp4', absPath: '/media/e02.mp4', hash: 'hash-2' },
      ],
    });

    const result = await checkTitleCardRecords(context);

    expect(result.episodes[0].titleCards).toEqual([]);
  });
});
