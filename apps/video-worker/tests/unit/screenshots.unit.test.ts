import fs from 'fs';
import { execFile } from 'child_process';
import { runScreenshotsOperation } from '../../src/worker/operations/screenshots';
import { JobProcessingError } from '../../src/worker/job-processing-error';
import type { VideoJob } from '@abbottland/video-db';

jest.mock('fs');
jest.mock('child_process', () => ({
  execFile: jest.fn(
    (
      _file: string,
      _args: string[],
      callback: (err: Error | null, result?: unknown) => void,
    ) => {
      callback(null, { stdout: '', stderr: '' });
    },
  ),
}));
jest.mock('../../src/config', () => ({
  config: { mediaRoot: '/media', ffmpegPath: 'ffmpeg' },
}));

const buildJob = (overrides: Partial<VideoJob> = {}): VideoJob =>
  ({
    id: 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
    operation: 'screenshots',
    status: 'processing',
    inputPath: '/videos/example.mp4',
    outputPaths: null,
    parameters: { timestamps: [30, 120] },
    attempts: 1,
    workerId: 'worker-1',
    createdAt: new Date(),
    startedAt: new Date(),
    completedAt: null,
    heartbeatAt: new Date(),
    error: null,
    ...overrides,
  }) as VideoJob;

describe('runScreenshotsOperation', () => {
  beforeEach(() => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects missing/invalid parameters', async () => {
    await expect(
      runScreenshotsOperation(buildJob({ parameters: {} })),
    ).rejects.toThrow(JobProcessingError);
  });

  it('rejects an inputPath that escapes MEDIA_ROOT', async () => {
    await expect(
      runScreenshotsOperation(buildJob({ inputPath: '../../etc/passwd' })),
    ).rejects.toThrow(/escapes MEDIA_ROOT/);
  });

  it('rejects when the input file does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    await expect(runScreenshotsOperation(buildJob())).rejects.toThrow(
      /input file not found/,
    );
  });

  it('runs ffmpeg once per timestamp and returns output paths in order', async () => {
    const job = buildJob();

    const outputPaths = await runScreenshotsOperation(job);

    expect(outputPaths).toEqual([
      `/screenshots/${job.id}/30.jpg`,
      `/screenshots/${job.id}/120.jpg`,
    ]);
    expect(execFile).toHaveBeenCalledTimes(2);
    expect(execFile).toHaveBeenNthCalledWith(
      1,
      'ffmpeg',
      expect.arrayContaining(['-ss', '30', '-i', '/media/videos/example.mp4']),
      expect.any(Function),
    );
  });

  it('propagates an ffmpeg failure', async () => {
    (execFile as unknown as jest.Mock).mockImplementationOnce(
      (_file, _args, callback) => callback(new Error('ffmpeg exploded')),
    );

    await expect(runScreenshotsOperation(buildJob())).rejects.toThrow(
      'ffmpeg exploded',
    );
  });
});
