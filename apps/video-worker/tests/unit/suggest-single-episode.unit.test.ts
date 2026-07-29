import { chatCompletion } from '../../src/api/ai/ai-client';
import { suggestSingleEpisode } from '../../src/worker/operations/paw-patrol-file-suggestions/lib/suggest-single-episode';

jest.mock('../../src/api/ai/ai-client', () => ({
  chatCompletion: jest.fn(),
}));
jest.mock('../../src/config', () => ({
  config: { aiModel: 'test-model' },
}));

describe('suggestSingleEpisode', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sends the filename, title-card text, and Sonarr episode list in the prompt', async () => {
    (chatCompletion as jest.Mock).mockResolvedValue('{"found":false}');

    await suggestSingleEpisode('e01.mp4', 'Pups Save a Blimp', [
      { seasonNumber: 3, episodeNumber: 1, title: 'Pups Save a Blimp' },
    ]);

    const call = (chatCompletion as jest.Mock).mock.calls[0][0];
    expect(call.model).toBe('test-model');
    const userMessage = call.messages.find(
      (message: { role: string }) => message.role === 'user',
    );
    expect(userMessage.content).toContain('e01.mp4');
    expect(userMessage.content).toContain('Pups Save a Blimp');
    expect(userMessage.content).toContain('E1: Pups Save a Blimp');
  });

  it('parses a found match', async () => {
    (chatCompletion as jest.Mock).mockResolvedValue(
      '{"found":true,"episodeNumber":1,"episodeTitle":"Pups Save a Blimp"}',
    );

    await expect(
      suggestSingleEpisode('e01.mp4', 'Pups Save a Blimp', []),
    ).resolves.toEqual({
      found: true,
      episodeNumber: 1,
      episodeTitle: 'Pups Save a Blimp',
    });
  });

  it('parses no match', async () => {
    (chatCompletion as jest.Mock).mockResolvedValue('{"found":false}');

    await expect(suggestSingleEpisode('e01.mp4', '', [])).resolves.toEqual({
      found: false,
    });
  });
});
