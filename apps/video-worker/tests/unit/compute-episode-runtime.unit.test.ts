import type { TitleCard, VideoJob } from '@abbottland/video-db';
import { getRuntimeSeconds } from '../../src/lib/get-runtime';
import { computeEpisodeRuntime } from '../../src/worker/operations/paw-patrol-title-cards/steps/compute-episode-runtime';
import type { PawPatrolTitleCardsContext } from '../../src/worker/operations/paw-patrol-title-cards/context';

jest.mock('../../src/lib/get-runtime', () => ({
  getRuntimeSeconds: jest.fn(),
}));

const buildContext = (
  overrides: Partial<PawPatrolTitleCardsContext> = {},
): PawPatrolTitleCardsContext => ({
  job: {} as VideoJob,
  seasonNumber: 3,
  model: 'test-model',
  episodes: [],
  outputPaths: [],
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

describe('computeEpisodeRuntime', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('probes runtime for an episode with no title_cards records', async () => {
    (getRuntimeSeconds as jest.Mock).mockResolvedValue(660);

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

    const result = await computeEpisodeRuntime(context);

    expect(result.episodes).toEqual([
      {
        filename: 'e01.mp4',
        absPath: '/media/e01.mp4',
        hash: 'hash-1',
        titleCards: [],
        runTimeSeconds: 660,
      },
    ]);
    expect(getRuntimeSeconds).toHaveBeenCalledWith('/media/e01.mp4');
  });

  it('skips probing for an episode that already has title_cards records', async () => {
    const context = buildContext({
      episodes: [
        {
          filename: 'e02.mp4',
          absPath: '/media/e02.mp4',
          hash: 'hash-2',
          titleCards: [buildTitleCard()],
        },
      ],
    });

    const result = await computeEpisodeRuntime(context);

    expect(result.episodes[0].runTimeSeconds).toBeUndefined();
    expect(getRuntimeSeconds).not.toHaveBeenCalled();
  });
});
