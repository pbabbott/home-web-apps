import { execFile } from 'child_process';
import {
  claimNextVideoJob,
  createVideoJob,
  getVideoJobById,
} from '@abbottland/video-db';
import { db } from '../../src/db';
import { processJob } from '../../src/worker/job-processor';

// No ffmpeg binary is guaranteed in CI/dev containers. Mocking the
// subprocess call keeps this test focused on what it can actually verify:
// the real claim -> process -> complete/fail round trip against Postgres.
//
// This exercises claimNextVideoJob + processJob directly rather than the
// poll loop's pollOnce(), which self-reschedules via a real setTimeout —
// fine for the always-running service, but it would race ahead into later
// tests here. The scheduling behavior itself is covered by
// tests/unit/poll-loop.unit.test.ts with mocked dependencies and fake timers.
jest.mock('child_process', () => ({
  execFile: jest.fn(
    (
      _file: string,
      _args: string[],
      callback: (err: Error | null, result?: unknown) => void,
    ) => callback(null, { stdout: '', stderr: '' }),
  ),
}));

describe('worker job processing', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('claims a pending screenshots job, runs ffmpeg per timestamp, and marks it completed', async () => {
    const created = await createVideoJob(db, {
      operation: 'screenshots',
      inputPath: '/videos/example.mp4',
      parameters: { timestamps: [30, 60] },
    });

    const claimed = await claimNextVideoJob(db, 'test-worker');
    expect(claimed?.id).toBe(created.id);

    await processJob(claimed!);

    const updated = await getVideoJobById(db, created.id);
    expect(updated?.status).toBe('completed');
    expect(updated?.outputPaths).toEqual([
      `/screenshots/${created.id}/30.jpg`,
      `/screenshots/${created.id}/60.jpg`,
    ]);
    expect(updated?.workerId).toBe('test-worker');
    expect(updated?.attempts).toBe(1);
    expect(execFile).toHaveBeenCalledTimes(2);
  });

  it('marks a job with an unsupported operation as failed', async () => {
    const created = await createVideoJob(db, {
      operation: 'transcode',
      inputPath: '/videos/example.mp4',
      parameters: {},
    });

    const claimed = await claimNextVideoJob(db, 'test-worker');
    expect(claimed?.id).toBe(created.id);

    await processJob(claimed!);

    const updated = await getVideoJobById(db, created.id);
    expect(updated?.status).toBe('failed');
    expect(updated?.error).toContain('unsupported operation');
    expect(execFile).not.toHaveBeenCalled();
  });

  it('returns undefined when nothing is pending', async () => {
    await expect(claimNextVideoJob(db, 'test-worker')).resolves.toBeUndefined();
  });
});
