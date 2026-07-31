import { chatCompletion, parseJsonResponse } from '../../src/api/ai/ai-client';

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

    const assertion = expect(
      chatCompletion({ model: 'm', messages: [] }),
    ).resolves.toBe('{"found":false}');
    await jest.runAllTimersAsync();
    await assertion;
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

describe('parseJsonResponse', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns the parsed JSON on success', () => {
    const request = {
      model: 'm',
      messages: [{ role: 'user' as const, content: 'hi' }],
    };

    expect(parseJsonResponse(request, '{"found":true}')).toEqual({
      found: true,
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('logs the prompt and raw response, then rethrows, on malformed JSON', () => {
    const request = {
      model: 'm',
      messages: [
        { role: 'system' as const, content: 'be terse' },
        { role: 'user' as const, content: 'describe this image' },
      ],
    };
    const content = '```json\n{"found":true}\n```';

    expect(() => parseJsonResponse(request, content)).toThrow(SyntaxError);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const logged = consoleErrorSpy.mock.calls[0][0] as string;
    expect(logged).toContain('m');
    expect(logged).toContain('be terse');
    expect(logged).toContain('describe this image');
    expect(logged).toContain(content);
  });

  it('summarizes image_url parts instead of dumping the raw base64', () => {
    const request = {
      model: 'm',
      messages: [
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: 'look at this' },
            {
              type: 'image_url' as const,
              image_url: { url: `data:image/jpeg;base64,${'A'.repeat(500)}` },
            },
          ],
        },
      ],
    };

    expect(() => parseJsonResponse(request, 'not json')).toThrow(SyntaxError);

    const logged = consoleErrorSpy.mock.calls[0][0] as string;
    expect(logged).toContain('look at this');
    expect(logged).toContain('[image omitted');
    expect(logged).not.toContain('A'.repeat(500));
  });
});
