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
// Also writes a stub file at ffmpeg's output path (its last arg, always a
// .jpg here) so detectEpisodeTitleCards has real bytes to read back off
// disk instead of a path that was never actually written to.
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
      args: string[],
      callback: (err: Error | null, result?: unknown) => void,
    ) => {
      const outputPath = args[args.length - 1];

      if (outputPath.endsWith('.jpg')) {
        require('fs').writeFileSync(outputPath, 'fake jpg bytes');
      }

      callback(null, { stdout: '', stderr: '' });
    },
  ),
}));

describe('worker job processing', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // 15 screenshots at the AI client's real 1 req/s throttle (3 concurrent)
  // take a few seconds by design, well past Jest's 5s default.
  it('completes a paw_patrol_title_cards job and records the handler message', async () => {
    const created = await createVideoJob(db, {
      operation: 'paw_patrol_title_cards',
      parameters: { seasonNumber: 3 },
    });

    const claimed = await claimNextVideoJob(db, 'test-worker');
    expect(claimed?.id).toBe(created.id);

    await processJob(claimed!);

    const updated = await getVideoJobById(db, created.id);
    expect(updated?.status).toBe('completed');
    expect(updated?.outputPaths).toHaveLength(15);
    expect(updated?.outputPaths?.[0]).toMatch(
      /^screenshots\/Paw Patrol\/Season 3\/[0-9a-f]{64}\/31_480x270\.jpg$/,
    );
    expect(updated?.message).toBe(
      'processed 1 episode(s), 15 screenshot(s) generated, 0 title card record(s) written, 1 with no title card detected',
    );
  }, 20000);

  it('marks a job with an unsupported operation as failed', async () => {
    const created = await createVideoJob(db, {
      operation: 'transcode',
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
