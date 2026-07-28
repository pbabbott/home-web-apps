import type { VideoJob } from '@abbottland/video-db';
import { runPawPatrolTitleCardsOperation } from '../../src/worker/operations/paw-patrol-title-cards';
import { JobProcessingError } from '../../src/worker/job-processing-error';

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

describe('runPawPatrolTitleCardsOperation', () => {
  it('rejects parameters without a numeric seasonNumber', async () => {
    const job = buildJob({ parameters: {} });

    await expect(runPawPatrolTitleCardsOperation(job)).rejects.toThrow(
      JobProcessingError,
    );
  });

  it('returns no output paths or message with an empty step pipeline', async () => {
    const job = buildJob();

    await expect(runPawPatrolTitleCardsOperation(job)).resolves.toEqual({
      outputPaths: [],
      message: '',
    });
  });
});
