import fs from 'fs';
import type { VideoJob } from '@abbottland/video-db';
import { runPawPatrolTitleCardsOperation } from '../../src/worker/operations/paw-patrol-title-cards';
import { JobProcessingError } from '../../src/worker/job-processing-error';

jest.mock('fs');
jest.mock('../../src/config', () => ({
  config: { mediaRoot: '/media' },
}));
jest.mock('@abbottland/video-db', () => ({
  hashFile: jest.fn().mockResolvedValue('fakehash'),
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

  it('runs the full pipeline (list + hash) and returns no output paths or message yet', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
    (fs.readdirSync as jest.Mock).mockReturnValue([
      direntFor('Paw Patrol - S03E01 - Pups Save a Blimp.mp4', true),
    ]);

    const job = buildJob();

    await expect(runPawPatrolTitleCardsOperation(job)).resolves.toEqual({
      outputPaths: [],
      message: '',
    });
  });
});
