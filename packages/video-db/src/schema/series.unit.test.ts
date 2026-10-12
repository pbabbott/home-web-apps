import { seriesSelectSchema } from './series';

describe('seriesSelectSchema', () => {
  it('accepts a realistic row shape', () => {
    const result = seriesSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      seriesName: 'Paw Patrol',
      directoryName: 'Paw Patrol',
      seasonCount: 13,
      createdAt: new Date(),
    });

    expect(result.success).toBe(true);
  });

  it('rejects a row missing seriesName', () => {
    const result = seriesSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      directoryName: 'Paw Patrol',
      seasonCount: 13,
      createdAt: new Date(),
    });

    expect(result.success).toBe(false);
  });
});
