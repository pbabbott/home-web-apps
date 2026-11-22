import {
  parseRateLimit,
  ynabGet,
  YnabApiError,
} from '../../src/api/ynab/ynab-client';

jest.mock('../../src/config', () => ({
  config: { ynab: { apiUrl: 'https://ynab.test/v1', apiToken: 'tok' } },
}));

const mockFetch = (response: Partial<Response> & { headers?: Headers }) => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(response) as unknown as typeof fetch;
  return global.fetch as unknown as jest.Mock;
};

describe('ynab-client', () => {
  it('parses the X-Rate-Limit header', () => {
    expect(parseRateLimit('36/200')).toEqual({ used: 36, total: 200 });
    expect(parseRateLimit(null)).toBeNull();
    expect(parseRateLimit('nonsense')).toBeNull();
  });

  it('sends the bearer token and last_knowledge_of_server, and returns server_knowledge', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      headers: new Headers({ 'X-Rate-Limit': '5/200' }),
      json: () => Promise.resolve({ data: { server_knowledge: 42 } }),
    });

    const result = await ynabGet('/plans/p1/accounts', { lastKnowledge: 7 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'https://ynab.test/v1/plans/p1/accounts?last_knowledge_of_server=7',
    );
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(result.serverKnowledge).toBe(42);
    expect(result.rateLimit).toEqual({ used: 5, total: 200 });
  });

  it('omits the delta parameter without a cursor', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({ data: {} }),
    });

    const result = await ynabGet('/plans');

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://ynab.test/v1/plans',
    );
    expect(result.serverKnowledge).toBeNull();
  });

  it('throws a rate-limited YnabApiError on 429', async () => {
    mockFetch({ ok: false, status: 429, headers: new Headers() });

    await expect(ynabGet('/plans')).rejects.toMatchObject({
      status: 429,
      isRateLimited: true,
    });
    await expect(ynabGet('/plans')).rejects.toBeInstanceOf(YnabApiError);
  });
});
