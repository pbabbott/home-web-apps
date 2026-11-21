import { createJobSchema } from '../../src/schemas/jobs';

describe('createJobSchema', () => {
  it('accepts a hello job and defaults parameters', () => {
    const result = createJobSchema.safeParse({ operation: 'hello' });

    expect(result.success).toBe(true);
  });

  it('rejects an unknown operation', () => {
    const result = createJobSchema.safeParse({ operation: 'nope' });

    expect(result.success).toBe(false);
  });
});
