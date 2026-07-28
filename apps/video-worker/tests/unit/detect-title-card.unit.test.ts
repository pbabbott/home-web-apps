import {
  getAiResponseCache,
  upsertAiResponseCache,
} from '@abbottland/video-db';
import { chatCompletion } from '../../src/api/ai/ai-client';
import { detectTitleCard } from '../../src/worker/operations/paw-patrol-title-cards/lib/detect-title-card';

jest.mock('../../src/api/ai/ai-client', () => ({
  chatCompletion: jest.fn(),
}));
jest.mock('@abbottland/video-db', () => ({
  getAiResponseCache: jest.fn(),
  upsertAiResponseCache: jest.fn(),
}));
jest.mock('../../src/config', () => ({
  config: { aiModel: 'qwen/qwen3-vl-8b-instruct' },
}));
jest.mock('../../src/db', () => ({ db: {} }));

const SCREENSHOT_PATH = 'screenshots/Paw Patrol/Season 3/hash-1/45_480x270.jpg';

describe('detectTitleCard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the cached response without calling the AI API', async () => {
    (getAiResponseCache as jest.Mock).mockResolvedValue({
      id: 'row-1',
      screenshotPath: SCREENSHOT_PATH,
      model: 'qwen/qwen3-vl-8b-instruct',
      response: { found: true, title: 'Pups Save a Blimp' },
      createdAt: new Date(),
    });

    const result = await detectTitleCard(
      SCREENSHOT_PATH,
      'BASE64DATA',
      'image/jpeg',
    );

    expect(result).toEqual({ found: true, title: 'Pups Save a Blimp' });
    expect(getAiResponseCache).toHaveBeenCalledWith(
      {},
      SCREENSHOT_PATH,
      'qwen/qwen3-vl-8b-instruct',
    );
    expect(chatCompletion).not.toHaveBeenCalled();
    expect(upsertAiResponseCache).not.toHaveBeenCalled();
  });

  it('calls the AI API and caches the result on a cache miss', async () => {
    (getAiResponseCache as jest.Mock).mockResolvedValue(undefined);
    (chatCompletion as jest.Mock).mockResolvedValue(
      JSON.stringify({ found: false }),
    );

    const result = await detectTitleCard(
      SCREENSHOT_PATH,
      'BASE64DATA',
      'image/jpeg',
    );

    expect(result).toEqual({ found: false });
    expect(chatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'qwen/qwen3-vl-8b-instruct' }),
    );
    expect(upsertAiResponseCache).toHaveBeenCalledWith(
      {},
      {
        screenshotPath: SCREENSHOT_PATH,
        model: 'qwen/qwen3-vl-8b-instruct',
        response: { found: false },
      },
    );
  });

  it('sends the image as a data URL on a cache miss', async () => {
    (getAiResponseCache as jest.Mock).mockResolvedValue(undefined);
    (chatCompletion as jest.Mock).mockResolvedValue('{"found":false}');

    await detectTitleCard(SCREENSHOT_PATH, 'BASE64DATA', 'image/jpeg');

    const request = (chatCompletion as jest.Mock).mock.calls[0][0];
    expect(request.messages[0]).toEqual({
      role: 'system',
      content: expect.stringContaining('extract text from images'),
    });
    expect(request.messages[1].role).toBe('user');
    expect(request.messages[1].content[0].type).toBe('text');
    expect(request.messages[1].content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,BASE64DATA' },
    });
  });

  it('throws (and does not cache) when the response is not valid JSON', async () => {
    (getAiResponseCache as jest.Mock).mockResolvedValue(undefined);
    (chatCompletion as jest.Mock).mockResolvedValue('not json');

    await expect(
      detectTitleCard(SCREENSHOT_PATH, 'BASE64DATA', 'image/jpeg'),
    ).rejects.toThrow();
    expect(upsertAiResponseCache).not.toHaveBeenCalled();
  });
});
