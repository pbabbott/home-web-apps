import fs from 'fs';
import type { VideoJob } from '@abbottland/video-db';
import { runPawPatrolTitleCardsOperation } from '../../src/worker/operations/paw-patrol-title-cards';
import { JobProcessingError } from '../../src/worker/job-processing-error';

jest.mock('fs');
jest.mock('child_process', () => ({
  execFile: jest.fn(
    (
      _file: string,
      _args: string[],
      callback: (err: Error | null, result?: unknown) => void,
    ) => callback(null, { stdout: '0\n', stderr: '' }),
  ),
}));
jest.mock('../../src/config', () => ({
  config: {
    mediaRoot: '/media',
    ffprobePath: 'ffprobe',
    ffmpegPath: 'ffmpeg',
    aiModel: 'default-model',
  },
}));
jest.mock('@abbottland/video-db', () => ({
  hashFile: jest.fn().mockResolvedValue('fakehash'),
  listTitleCards: jest.fn().mockResolvedValue([]),
  getAiResponseCache: jest.fn().mockResolvedValue(undefined),
  upsertAiResponseCache: jest.fn().mockResolvedValue(undefined),
  upsertTitleCard: jest.fn(),
}));
jest.mock('../../src/db', () => ({ db: {} }));
jest.mock('../../src/api/ai/ai-client', () => ({
  ...jest.requireActual('../../src/api/ai/ai-client'),
  chatCompletion: jest.fn().mockResolvedValue('{"found":false}'),
}));

const buildJob = (overrides: Partial<VideoJob> = {}): VideoJob =>
  ({
    id: 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
    operation: 'paw_patrol_title_cards',
    status: 'processing',
    outputPaths: null,
    parameters: { seasonNumber: 3 },
    attempts: 1,
    workerId: 'worker-1',
    createdAt: new Date(),
    startedAt: new Date(),
    completedAt: null,
    heartbeatAt: new Date(),
    error: null,
    ...overrides,
  }) as VideoJob;

const direntFor = (name: string, isFile: boolean) =>
  ({ name, isFile: () => isFile }) as fs.Dirent;

describe('runPawPatrolTitleCardsOperation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects parameters without a numeric seasonNumber', async () => {
    const job = buildJob({ parameters: {} });

    await expect(runPawPatrolTitleCardsOperation(job)).rejects.toThrow(
      JobProcessingError,
    );
  });

  it('rejects a season that has no matching directory under MEDIA_ROOT', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const job = buildJob({ parameters: { seasonNumber: 99 } });

    await expect(runPawPatrolTitleCardsOperation(job)).rejects.toThrow(
      JobProcessingError,
    );
  });

  it('runs the full pipeline and returns the generated screenshot paths', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
    (fs.readdirSync as jest.Mock).mockReturnValue([
      direntFor('Paw Patrol - S03E01 - Pups Save a Blimp.mp4', true),
    ]);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('jpegbytes'));

    const job = buildJob();

    const result = await runPawPatrolTitleCardsOperation(job);

    expect(result.message).toBe(
      'processed 1 episode(s), 15 screenshot(s) generated, 0 title card record(s) written, 1 with no title card detected',
    );
    expect(result.outputPaths).toHaveLength(15);
    expect(result.outputPaths[0]).toBe(
      'screenshots/Paw Patrol/Season 3/fakehash/31_480x270.jpg',
    );
  });

  it('summarizes a mix of already-done and newly-processed episodes', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
    (fs.readdirSync as jest.Mock).mockReturnValue([
      direntFor('Paw Patrol - S03E01 - Pups Save a Blimp.mp4', true),
      direntFor('Paw Patrol - S03E02 - Pups Save a Train.mp4', true),
    ]);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('jpegbytes'));

    const { hashFile, listTitleCards } = jest.requireMock(
      '@abbottland/video-db',
    ) as {
      hashFile: jest.Mock;
      listTitleCards: jest.Mock;
    };
    hashFile.mockImplementation(async (absPath: string) =>
      absPath.includes('E01') ? 'hash-done' : 'hash-new',
    );
    listTitleCards.mockImplementation(async (_db: unknown, { fileHash }) =>
      fileHash === 'hash-done'
        ? [{ id: 't1', fileHash: 'hash-done', title: 'existing' }]
        : [],
    );

    const job = buildJob();

    const result = await runPawPatrolTitleCardsOperation(job);

    expect(result.message).toBe(
      'processed 1 episode(s), 15 screenshot(s) generated, 0 title card record(s) written, 1 already had title cards, 1 with no title card detected',
    );
  });
});
