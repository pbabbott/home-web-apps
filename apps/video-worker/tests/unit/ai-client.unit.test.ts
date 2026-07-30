import { chatCompletion } from '../../src/api/ai/ai-client';

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

describe('chatCompletion', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('POSTs the request to <aiApiUrl>/v1/chat/completions', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'hello' } }] }),
    );

    const request = {
      model: 'some-model',
      messages: [{ role: 'user' as const, content: 'hi' }],
    };

    await chatCompletion(request);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://ai.local:1234/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
    );
  });

  it('returns the first choice message content', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: '{"found":false}' } }],
      }),
    );

    await expect(chatCompletion({ model: 'm', messages: [] })).resolves.toBe(
      '{"found":false}',
    );
  });

  it('throws when the API responds with a non-ok status', async () => {
    mockFetch.mockResolvedValue(jsonResponse('server error', false, 500));

    const assertion = expect(
      chatCompletion({ model: 'm', messages: [] }),
    ).rejects.toThrow('AI API request failed: 500');
    await jest.runAllTimersAsync();
    await assertion;

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('throws when the response has no message content', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ choices: [] }));

    const assertion = expect(
      chatCompletion({ model: 'm', messages: [] }),
    ).rejects.toThrow('no message content');
    await jest.runAllTimersAsync();
    await assertion;

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('retries a transient fetch failure and succeeds once the API responds', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(
        jsonResponse({ choices: [{ message: { content: 'recovered' } }] }),
      );

    const assertion = expect(
      chatCompletion({ model: 'm', messages: [] }),
    ).resolves.toBe('recovered');
    await jest.runAllTimersAsync();
    await assertion;

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
