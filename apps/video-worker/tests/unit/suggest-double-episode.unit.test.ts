import { chatCompletion } from '../../src/api/ai/ai-client';
import { suggestDoubleEpisode } from '../../src/worker/operations/paw-patrol-file-suggestions/lib/suggest-double-episode';

jest.mock('../../src/api/ai/ai-client', () => ({
  ...jest.requireActual('../../src/api/ai/ai-client'),
  chatCompletion: jest.fn(),
}));

describe('suggestDoubleEpisode', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sends both title cards in file order and the Sonarr episode list, using the given model', async () => {
    (chatCompletion as jest.Mock).mockResolvedValue('{"found":false}');

    await suggestDoubleEpisode(
      'e18-19.mp4',
      'Pups Save a Goldrush',
      'Pups Save a Space Alien',
      [
        { seasonNumber: 3, episodeNumber: 18, title: 'Pups Save a Goldrush' },
        {
          seasonNumber: 3,
          episodeNumber: 19,
          title: 'Pups Save a Space Alien',
        },
      ],
      'test-model',
    );

    const call = (chatCompletion as jest.Mock).mock.calls[0][0];
    expect(call.model).toBe('test-model');
    const userMessage = call.messages.find(
      (message: { role: string }) => message.role === 'user',
    );
    expect(userMessage.content).toContain('e18-19.mp4');
    expect(userMessage.content).toContain('Pups Save a Goldrush');
    expect(userMessage.content).toContain('Pups Save a Space Alien');
    expect(userMessage.content).toContain('E18: Pups Save a Goldrush');
    expect(userMessage.content).toContain('E19: Pups Save a Space Alien');
  });

  it('parses a found match preserving file order', async () => {
    (chatCompletion as jest.Mock).mockResolvedValue(
      '{"found":true,"episodes":[{"episodeNumber":18,"episodeTitle":"Pups Save a Goldrush"},{"episodeNumber":19,"episodeTitle":"Pups Save a Space Alien"}]}',
    );

    await expect(
      suggestDoubleEpisode('e18-19.mp4', 'a', 'b', [], 'test-model'),
    ).resolves.toEqual({
      found: true,
      episodes: [
        { episodeNumber: 18, episodeTitle: 'Pups Save a Goldrush' },
        { episodeNumber: 19, episodeTitle: 'Pups Save a Space Alien' },
      ],
    });
  });

  it('parses no match', async () => {
    (chatCompletion as jest.Mock).mockResolvedValue('{"found":false}');

    await expect(
      suggestDoubleEpisode('e18-19.mp4', 'a', 'b', [], 'test-model'),
    ).resolves.toEqual({ found: false });
  });
});
