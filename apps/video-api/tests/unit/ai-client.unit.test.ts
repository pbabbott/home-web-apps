import { getAiStatus } from '../../src/api/ai/ai-client';

jest.mock('../../src/config', () => ({
  config: { aiApiUrl: 'http://ai.local:1234' },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  text: () => Promise.resolve(JSON.stringify(body)),
  json: () => Promise.resolve(body),
});

describe('getAiStatus', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('GETs <aiApiUrl>/v1/models', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [] }));

    await getAiStatus();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://ai.local:1234/v1/models',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('reports online with the loaded model ids', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ data: [{ id: 'model-a' }, { id: 'model-b' }] }),
    );

    await expect(getAiStatus()).resolves.toEqual({
      online: true,
      models: ['model-a', 'model-b'],
    });
  });

  it('reports offline when the server responds with a non-ok status', async () => {
    mockFetch.mockResolvedValue(jsonResponse('server error', false, 500));

    await expect(getAiStatus()).resolves.toEqual({
      online: false,
      models: [],
    });
  });

  it('reports offline when the request fails (e.g. connection refused or timeout)', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));

    await expect(getAiStatus()).resolves.toEqual({
      online: false,
      models: [],
    });
  });
});
