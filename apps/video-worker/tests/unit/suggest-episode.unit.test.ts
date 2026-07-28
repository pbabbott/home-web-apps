import { chatCompletion } from '../../src/api/ai/ai-client';
import { suggestEpisode } from '../../src/worker/operations/paw-patrol-file-suggestions/lib/suggest-episode';

jest.mock('../../src/api/ai/ai-client', () => ({
  chatCompletion: jest.fn(),
}));
jest.mock('../../src/config', () => ({
  config: { aiModel: 'test-model' },
}));

describe('suggestEpisode', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sends the filename, title-card text, and Sonarr episode list in the prompt', async () => {
    (chatCompletion as jest.Mock).mockResolvedValue('{"found":false}');

    await suggestEpisode(
      'e01.mp4',
      ['Pups Save a Blimp'],
      [{ seasonNumber: 3, episodeNumber: 1, title: 'Pups Save a Blimp' }],
    );

    expect(chatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('e01.mp4'),
          }),
        ]),
      }),
    );

    const call = (chatCompletion as jest.Mock).mock.calls[0][0];
    const userMessage = call.messages.find(
      (message: { role: string }) => message.role === 'user',
    );
    expect(userMessage.content).toContain('Pups Save a Blimp');
    expect(userMessage.content).toContain('E1: Pups Save a Blimp');
  });

  it('parses a found match', async () => {
    (chatCompletion as jest.Mock).mockResolvedValue(
      '{"found":true,"episodeNumber":1,"episodeTitle":"Pups Save a Blimp"}',
    );

    await expect(suggestEpisode('e01.mp4', [], [])).resolves.toEqual({
      found: true,
      episodeNumber: 1,
      episodeTitle: 'Pups Save a Blimp',
    });
  });

  it('parses no match', async () => {
    (chatCompletion as jest.Mock).mockResolvedValue('{"found":false}');

    await expect(suggestEpisode('e01.mp4', [], [])).resolves.toEqual({
      found: false,
    });
  });
});
