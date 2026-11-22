import { ynabRawResponseSelectSchema } from './ynab-raw-responses';

describe('ynabRawResponseSelectSchema', () => {
  it('accepts a realistic delta row', () => {
    const result = ynabRawResponseSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      jobId: null,
      planId: 'plan-1',
      endpoint: 'transactions',
      requestParams: { last_knowledge_of_server: 10 },
      serverKnowledgeRequested: 10,
      serverKnowledgeReturned: 12,
      httpStatus: 200,
      payload: { data: { transactions: [] } },
      payloadSha256: 'abc',
      fetchedAt: new Date(),
    });

    expect(result.success).toBe(true);
  });
});
