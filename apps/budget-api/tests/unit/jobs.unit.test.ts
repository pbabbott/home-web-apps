import {
  createJobSchema,
  listRawResponsesQuerySchema,
} from '../../src/schemas/jobs';

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
      parameters: { endpoints: ['transactions'], full: true },
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

describe('listRawResponsesQuerySchema', () => {
  it('coerces limit from a query string', () => {
    const result = listRawResponsesQuerySchema.safeParse({ limit: '25' });

    expect(result.success && result.data.limit).toBe(25);
  });

  it('rejects an out-of-range limit and an unknown endpoint', () => {
    expect(
      listRawResponsesQuerySchema.safeParse({ limit: '500' }).success,
    ).toBe(false);
    expect(
      listRawResponsesQuerySchema.safeParse({ endpoint: 'nope' }).success,
    ).toBe(false);
  });
});
