import { videoJobSelectSchema } from './video-jobs';

describe('videoJobSelectSchema', () => {
  it('accepts a realistic row shape', () => {
    const row = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      operation: 'paw_patrol_title_cards',
      status: 'pending',
      outputPaths: null,
      parameters: { seasonNumber: 3 },
      attempts: 0,
      workerId: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      heartbeatAt: null,
      error: null,
    };

    const result = videoJobSelectSchema.safeParse(row);

    expect(result.success).toBe(true);
  });

  it('accepts multiple output paths', () => {
    const result = videoJobSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      operation: 'paw_patrol_title_cards',
      status: 'completed',
      outputPaths: [
        '/title-cards/example-00030.jpg',
        '/title-cards/example-00120.jpg',
      ],
      parameters: { seasonNumber: 3 },
      attempts: 1,
      workerId: 'worker-1',
      createdAt: new Date(),
      startedAt: new Date(),
      completedAt: new Date(),
      heartbeatAt: new Date(),
      error: null,
    });

    expect(result.success).toBe(true);
  });

  it('rejects a row with an invalid status', () => {
    const result = videoJobSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      operation: 'paw_patrol_title_cards',
      status: 'bogus',
      outputPaths: null,
      parameters: {},
      attempts: 0,
      workerId: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      heartbeatAt: null,
      error: null,
    });

    expect(result.success).toBe(false);
  });
});
