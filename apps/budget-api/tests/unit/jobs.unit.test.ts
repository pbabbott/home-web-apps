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

  it('accepts a ynab_sync job with options', () => {
    const result = createJobSchema.safeParse({
      operation: 'ynab_sync',
      parameters: { planIds: ['p1'], endpoints: ['transactions'], full: true },
    });

    expect(result.success).toBe(true);
  });

  it('rejects a ynab_sync job with an unknown endpoint', () => {
    const result = createJobSchema.safeParse({
      operation: 'ynab_sync',
      parameters: { endpoints: ['plans'] },
    });

    expect(result.success).toBe(false);
  });
});
