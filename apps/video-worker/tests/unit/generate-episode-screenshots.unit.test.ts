import fs from 'fs';
import { execFile } from 'child_process';
import type { TitleCard, VideoJob } from '@abbottland/video-db';
import { generateEpisodeScreenshots } from '../../src/worker/operations/paw-patrol-title-cards/steps/generate-episode-screenshots';
import { JobProcessingError } from '../../src/worker/job-processing-error';
import type { PawPatrolTitleCardsContext } from '../../src/worker/operations/paw-patrol-title-cards/context';

jest.mock('fs');
jest.mock('child_process', () => ({
  execFile: jest.fn(
    (
      _file: string,
      _args: string[],
      callback: (err: Error | null, result?: unknown) => void,
    ) => callback(null, { stdout: '', stderr: '' }),
  ),
}));
jest.mock('../../src/config', () => ({
  config: { mediaRoot: '/media', ffmpegPath: 'ffmpeg' },
}));

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
  filePath: '/media/e01.mp4',
  timestampSeconds: 30,
  runTimeSeconds: 600,
  title: 'Pups Save a Blimp',
  screenshotPath: null,
  screenshotBase64: null,
  createdAt: new Date(),
  ...overrides,
});

describe('generateEpisodeScreenshots', () => {
  beforeEach(() => {
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.existsSync as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an episode with no hash yet', async () => {
    const context = buildContext({
      episodes: [
        { filename: 'e01.mp4', absPath: '/media/e01.mp4', titleCards: [] },
      ],
    });

    await expect(generateEpisodeScreenshots(context)).rejects.toThrow(
      JobProcessingError,
    );
  });

  it('rejects an episode with no runtime yet', async () => {
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

    await expect(generateEpisodeScreenshots(context)).rejects.toThrow(
      JobProcessingError,
    );
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

    const result = await generateEpisodeScreenshots(context);

    expect(result.episodes[0].screenshotPaths).toBeUndefined();
    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(execFile).not.toHaveBeenCalled();
  });

  it('generates 15 screenshots (31..59 odd) for a <=780s episode missing title_cards', async () => {
    const context = buildContext({
      seasonNumber: 3,
      episodes: [
        {
          filename: 'e01.mp4',
          absPath: '/media/e01.mp4',
          hash: 'hash-1',
          titleCards: [],
          runTimeSeconds: 780,
        },
      ],
    });

    const result = await generateEpisodeScreenshots(context);

    expect(fs.mkdirSync).toHaveBeenCalledWith(
      '/media/screenshots/Paw Patrol/Season 3/hash-1',
      { recursive: true },
    );

    const expectedTimestamps = [
      31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59,
    ];
    const expectedPaths = expectedTimestamps.map(
      (t) => `screenshots/Paw Patrol/Season 3/hash-1/${t}_480x270.jpg`,
    );

    expect(result.episodes[0].screenshotPaths).toEqual(expectedPaths);
    expect(result.outputPaths).toEqual(expectedPaths);
    expect(execFile).toHaveBeenCalledTimes(15);
    expect(execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining([
        '-ss',
        '45',
        '-i',
        '/media/e01.mp4',
        '-vf',
        'scale=480:270',
      ]),
      expect.any(Function),
    );
  });

  it('skips ffmpeg for screenshots that already exist on disk', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);

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

    const result = await generateEpisodeScreenshots(context);

    expect(execFile).not.toHaveBeenCalled();
    expect(result.episodes[0].screenshotPaths).toHaveLength(15);
  });

  it('samples both 45s and 705s for an episode longer than 780s', async () => {
    const context = buildContext({
      seasonNumber: 3,
      episodes: [
        {
          filename: 'e01.mp4',
          absPath: '/media/e01.mp4',
          hash: 'hash-1',
          titleCards: [],
          runTimeSeconds: 781,
        },
      ],
    });

    const result = await generateEpisodeScreenshots(context);

    expect(result.episodes[0].screenshotPaths).toHaveLength(30);
    expect(execFile).toHaveBeenCalledTimes(30);
    expect(execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-ss', '705']),
      expect.any(Function),
    );
    expect(
      result.episodes[0].screenshotPaths?.includes(
        'screenshots/Paw Patrol/Season 3/hash-1/691_480x270.jpg',
      ),
    ).toBe(true);
    expect(
      result.episodes[0].screenshotPaths?.includes(
        'screenshots/Paw Patrol/Season 3/hash-1/719_480x270.jpg',
      ),
    ).toBe(true);
  });
});
