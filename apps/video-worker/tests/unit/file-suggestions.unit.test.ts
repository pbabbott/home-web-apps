import fs from 'fs';
import { upsertFileRename } from '@abbottland/video-db';
import type { VideoJob } from '@abbottland/video-db';
import { runFileSuggestionsOperation } from '../../src/worker/operations/file-suggestions';
import { JobProcessingError } from '../../src/worker/job-processing-error';

jest.mock('fs');
jest.mock('../../src/config', () => ({
  config: {
    mediaRoot: '/media',
    aiModel: 'test-model',
    sonarr: { apiUrl: 'http://sonarr.local:8989', apiKey: 'key-1' },
  },
}));
jest.mock('@abbottland/video-db', () => ({
  hashFile: jest.fn().mockResolvedValue('fakehash'),
  listFileRenames: jest.fn().mockResolvedValue([]),
  listTitleCards: jest.fn().mockResolvedValue([{ title: 'Pups Save a Blimp' }]),
  upsertFileRename: jest.fn().mockResolvedValue({}),
  getSeriesByName: jest.fn().mockResolvedValue({
    id: 'series-1',
    seriesName: 'Paw Patrol',
    directoryName: 'Paw Patrol',
    seasonCount: 13,
  }),
  createVideoJobStep: jest.fn().mockResolvedValue({ id: 'step-1' }),
  completeVideoJobStep: jest.fn(),
  failVideoJobStep: jest.fn(),
}));
jest.mock('../../src/db', () => ({ db: {} }));
jest.mock('../../src/api/sonarr/sonarr-client', () => ({
  getSeriesByTitle: jest.fn().mockResolvedValue({ id: 7, title: 'Paw Patrol' }),
  getSeasonEpisodes: jest
    .fn()
    .mockResolvedValue([
      { seasonNumber: 3, episodeNumber: 1, title: 'Pups Save a Blimp' },
    ]),
}));
jest.mock('../../src/api/ai/ai-client', () => ({
  ...jest.requireActual('../../src/api/ai/ai-client'),
  chatCompletion: jest
    .fn()
    .mockResolvedValue(
      '{"found":true,"episodeNumber":1,"episodeTitle":"Pups Save a Blimp"}',
    ),
}));

const buildJob = (overrides: Partial<VideoJob> = {}): VideoJob =>
  ({
    id: 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
    operation: 'file_suggestions',
    status: 'processing',
    parameters: { series: 'Paw Patrol', seasonNumber: 3 },
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

describe('runFileSuggestionsOperation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects parameters without a numeric seasonNumber', async () => {
    const job = buildJob({ parameters: {} });

    await expect(runFileSuggestionsOperation(job)).rejects.toThrow(
      JobProcessingError,
    );
  });

  it('rejects a season that has no matching directory under MEDIA_ROOT', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const job = buildJob({
      parameters: { series: 'Paw Patrol', seasonNumber: 99 },
    });

    await expect(runFileSuggestionsOperation(job)).rejects.toThrow(
      JobProcessingError,
    );
  });

  it('runs the full pipeline and saves a Plex-style suggestion', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
    (fs.readdirSync as jest.Mock).mockReturnValue([
      direntFor('random-name.mp4', true),
    ]);

    const job = buildJob();

    const result = await runFileSuggestionsOperation(job);

    expect(result.message).toBe('');
    expect(upsertFileRename).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        sourceTitleCardTitles: ['Pups Save a Blimp'],
      }),
    );
  });

  it('uses parameters.model instead of config.aiModel when given', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
    (fs.readdirSync as jest.Mock).mockReturnValue([
      direntFor('random-name.mp4', true),
    ]);

    const job = buildJob({
      parameters: {
        series: 'Paw Patrol',
        seasonNumber: 3,
        model: 'custom-model',
      },
    });

    await runFileSuggestionsOperation(job);

    const { chatCompletion } = jest.requireMock('../../src/api/ai/ai-client');
    expect(chatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'custom-model' }),
    );
  });
});
