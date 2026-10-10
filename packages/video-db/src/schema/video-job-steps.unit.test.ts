import { videoJobStepSelectSchema } from './video-job-steps';

describe('videoJobStepSelectSchema', () => {
  it('accepts an in-progress row', () => {
    const result = videoJobStepSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      jobId: '223e4567-e89b-12d3-a456-426614174000',
      stepName: 'list-season-files',
      status: 'in_progress',
      message: 'Listing season files',
      startedAt: new Date(),
      completedAt: null,
    });

    expect(result.success).toBe(true);
  });

  it('accepts a completed row', () => {
    const result = videoJobStepSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      jobId: '223e4567-e89b-12d3-a456-426614174000',
      stepName: 'list-season-files',
      status: 'completed',
      message: 'Listing season files — done',
      startedAt: new Date(),
      completedAt: new Date(),
    });

    expect(result.success).toBe(true);
  });

  it('accepts a failed row', () => {
    const result = videoJobStepSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      jobId: '223e4567-e89b-12d3-a456-426614174000',
      stepName: 'generate-episode-screenshots',
      status: 'failed',
      message: 'ffmpeg exited with code 1',
      startedAt: new Date(),
      completedAt: new Date(),
    });

    expect(result.success).toBe(true);
  });

  it('rejects a row with an invalid status', () => {
    const result = videoJobStepSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      jobId: '223e4567-e89b-12d3-a456-426614174000',
      stepName: 'list-season-files',
      status: 'bogus',
      message: null,
      startedAt: new Date(),
      completedAt: null,
    });

    expect(result.success).toBe(false);
  });
});
