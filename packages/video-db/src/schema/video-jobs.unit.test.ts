import { videoJobSelectSchema } from './video-jobs';

describe('videoJobSelectSchema', () => {
  it('accepts a realistic row shape', () => {
    const row = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      operation: 'paw_patrol_title_cards',
      status: 'pending',
      parameters: { seasonNumber: 3 },
      workerId: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      heartbeatAt: null,
      error: null,
      message: null,
    };

    const result = videoJobSelectSchema.safeParse(row);

    expect(result.success).toBe(true);
  });

  it('accepts a completed row', () => {
    const result = videoJobSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      operation: 'paw_patrol_title_cards',
      status: 'completed',
      parameters: { seasonNumber: 3 },
      workerId: 'worker-1',
      createdAt: new Date(),
      startedAt: new Date(),
      completedAt: new Date(),
      heartbeatAt: new Date(),
      error: null,
      message: 'processed 2 title cards',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a row with an invalid status', () => {
    const result = videoJobSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      operation: 'paw_patrol_title_cards',
      status: 'bogus',
      parameters: {},
      workerId: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      heartbeatAt: null,
      error: null,
      message: null,
    });

    expect(result.success).toBe(false);
  });
});
