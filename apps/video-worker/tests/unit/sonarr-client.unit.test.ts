import {
  getSeasonEpisodes,
  getSeriesByTitle,
} from '../../src/api/sonarr/sonarr-client';

jest.mock('../../src/config', () => ({
  config: { sonarr: { apiUrl: 'http://sonarr.local:8989', apiKey: 'key-1' } },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  text: () => Promise.resolve(JSON.stringify(body)),
  json: () => Promise.resolve(body),
});

describe('getSeriesByTitle', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('GETs the series list with the API key header', async () => {
    mockFetch.mockResolvedValue(jsonResponse([{ id: 7, title: 'Paw Patrol' }]));

    await getSeriesByTitle('Paw Patrol');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://sonarr.local:8989/api/v3/series',
      { headers: { 'X-Api-Key': 'key-1' } },
    );
  });

  it('returns the series matching the exact title', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse([
        { id: 1, title: 'Some Other Show' },
        { id: 7, title: 'Paw Patrol' },
      ]),
    );

    await expect(getSeriesByTitle('Paw Patrol')).resolves.toEqual({
      id: 7,
      title: 'Paw Patrol',
    });
  });

  it('throws when no series matches the title', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]));

    await expect(getSeriesByTitle('Paw Patrol')).rejects.toThrow(
      'Sonarr has no series titled "Paw Patrol"',
    );
  });

  it('throws when the API responds with a non-ok status', async () => {
    mockFetch.mockResolvedValue(jsonResponse('server error', false, 500));

    await expect(getSeriesByTitle('Paw Patrol')).rejects.toThrow(
      'Sonarr API request failed: 500',
    );
  });
});

describe('getSeasonEpisodes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('GETs episodes for the series and season', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse([
        { seasonNumber: 3, episodeNumber: 1, title: 'Pups Save a Blimp' },
      ]),
    );

    await getSeasonEpisodes(7, 3);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://sonarr.local:8989/api/v3/episode?seriesId=7&seasonNumber=3',
      { headers: { 'X-Api-Key': 'key-1' } },
    );
  });

  it('maps the response to seasonNumber/episodeNumber/title', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse([
        {
          seasonNumber: 3,
          episodeNumber: 1,
          title: 'Pups Save a Blimp',
          extraField: 'ignored',
        },
      ]),
    );

    await expect(getSeasonEpisodes(7, 3)).resolves.toEqual([
      { seasonNumber: 3, episodeNumber: 1, title: 'Pups Save a Blimp' },
    ]);
  });
});
