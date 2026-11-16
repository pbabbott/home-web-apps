import supertest from 'supertest';
import { createServer } from '../../src/server';
import { getMountpointSpace } from '../../src/api/prometheus';

jest.mock('../../src/api/prometheus', () => ({
  getMountpointSpace: jest.fn(),
}));

const SONARR_URL = 'http://sonarr.test';
const RADARR_URL = 'http://radarr.test';
const QBIT_URL = 'http://qbit.test';

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

/** Routes fetch by URL so a test can describe each upstream separately. */
function mockUpstreams(routes: Record<string, () => Response>) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    if (!key) throw new Error(`unexpected fetch: ${url}`);
    return routes[key]();
  });
}

const sonarrRoutes = {
  [`${SONARR_URL}/api/v3/queue`]: () => json({ totalRecords: 3 }),
  [`${SONARR_URL}/api/v3/history`]: () =>
    json({
      records: [
        {
          date: '2026-11-16T12:00:00Z',
          quality: { quality: { name: 'WEBDL-1080p' } },
          series: { title: 'Bluey' },
          episode: { title: 'Camping', seasonNumber: 2, episodeNumber: 5 },
        },
      ],
    }),
};

const radarrRoutes = {
  [`${RADARR_URL}/api/v3/queue`]: () => json({ totalRecords: 1 }),
  [`${RADARR_URL}/api/v3/history`]: () =>
    json({
      records: [
        {
          date: '2026-11-15T08:00:00Z',
          quality: { quality: { name: 'Bluray-1080p' } },
          movie: { title: 'Arrival', year: 2016 },
        },
      ],
    }),
};

const qbitRoutes = {
  [`${QBIT_URL}/api/v2/auth/login`]: () =>
    new Response('Ok.', { headers: { 'set-cookie': 'SID=abc; HttpOnly' } }),
  [`${QBIT_URL}/api/v2/transfer/info`]: () =>
    json({ dl_info_speed: 5000, up_info_speed: 100 }),
  [`${QBIT_URL}/api/v2/torrents/info`]: () =>
    json([
      {
        name: 'slow',
        progress: 0.1,
        size: 10,
        dlspeed: 10,
        upspeed: 0,
        eta: 100,
        state: 'downloading',
      },
      {
        name: 'fast',
        progress: 0.5,
        size: 20,
        dlspeed: 4000,
        upspeed: 5,
        eta: 8640000,
        state: 'downloading',
      },
    ]),
};

describe('media downloads routes', () => {
  const originalEnv = process.env;
  let fetchSpy: jest.SpyInstance | undefined;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SONARR_URL,
      SONARR_API_KEY: 'sonarr-key',
      RADARR_URL,
      RADARR_API_KEY: 'radarr-key',
      QBITTORRENT_URL: QBIT_URL,
      QBITTORRENT_USERNAME: 'admin',
      QBITTORRENT_PASSWORD: 'secret',
    };
    (getMountpointSpace as jest.Mock).mockResolvedValue({
      size: 100,
      avail: 40,
    });
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    process.env = originalEnv;
    fetchSpy?.mockRestore();
    jest.restoreAllMocks();
  });

  describe('GET /media/sonarr', () => {
    it('returns the queue size and the last imported episode', async () => {
      fetchSpy = mockUpstreams(sonarrRoutes);

      const res = await supertest(createServer())
        .get('/media/sonarr')
        .expect(200);

      expect(res.body).toEqual({
        queueCount: 3,
        lastImported: {
          title: 'Bluey',
          subtitle: 'S02E05 · Camping',
          quality: 'WEBDL-1080p',
          importedAt: '2026-11-16T12:00:00Z',
        },
      });
      const [, init] = fetchSpy.mock.calls[0];
      expect(init.headers).toEqual({ 'X-Api-Key': 'sonarr-key' });
    });

    it('returns a null lastImported when history is empty', async () => {
      fetchSpy = mockUpstreams({
        ...sonarrRoutes,
        [`${SONARR_URL}/api/v3/history`]: () => json({ records: [] }),
      });

      const res = await supertest(createServer())
        .get('/media/sonarr')
        .expect(200);

      expect(res.body.lastImported).toBeNull();
    });

    it('returns 503 without an API key', async () => {
      delete process.env.SONARR_API_KEY;

      await supertest(createServer()).get('/media/sonarr').expect(503);
    });

    it('returns 502 when Sonarr answers with an error', async () => {
      fetchSpy = mockUpstreams({
        ...sonarrRoutes,
        [`${SONARR_URL}/api/v3/queue`]: () => json({}, { status: 500 }),
      });

      await supertest(createServer()).get('/media/sonarr').expect(502);
    });
  });

  describe('GET /media/radarr', () => {
    it('returns the queue size and the last imported movie', async () => {
      fetchSpy = mockUpstreams(radarrRoutes);

      const res = await supertest(createServer())
        .get('/media/radarr')
        .expect(200);

      expect(res.body).toEqual({
        queueCount: 1,
        lastImported: {
          title: 'Arrival',
          subtitle: '2016',
          quality: 'Bluray-1080p',
          importedAt: '2026-11-15T08:00:00Z',
        },
      });
    });
  });

  describe('GET /media/qbittorrent', () => {
    it('logs in, then returns speeds and the active torrents fastest first', async () => {
      fetchSpy = mockUpstreams(qbitRoutes);

      const res = await supertest(createServer())
        .get('/media/qbittorrent')
        .expect(200);

      expect(res.body.downloadSpeed).toBe(5000);
      expect(res.body.activeCount).toBe(2);
      expect(res.body.torrents.map((t: { name: string }) => t.name)).toEqual([
        'fast',
        'slow',
      ]);
      // "infinity" ETA is reported as null
      expect(res.body.torrents[0].etaSeconds).toBeNull();
      expect(res.body.torrents[1].etaSeconds).toBe(100);
      const infoCall = fetchSpy.mock.calls.find(([url]) =>
        String(url).includes('torrents/info'),
      );
      expect(infoCall?.[1].headers.Cookie).toBe('SID=abc');
    });

    it('returns 502 when qBittorrent rejects the login', async () => {
      fetchSpy = mockUpstreams({
        ...qbitRoutes,
        [`${QBIT_URL}/api/v2/auth/login`]: () => new Response('Fails.'),
      });

      await supertest(createServer()).get('/media/qbittorrent').expect(502);
    });

    it('returns 503 without credentials', async () => {
      delete process.env.QBITTORRENT_PASSWORD;

      await supertest(createServer()).get('/media/qbittorrent').expect(503);
    });
  });

  describe('GET /media/downloads/summary', () => {
    it('combines the services', async () => {
      fetchSpy = mockUpstreams({
        ...sonarrRoutes,
        ...radarrRoutes,
        ...qbitRoutes,
      });

      const res = await supertest(createServer())
        .get('/media/downloads/summary')
        .expect(200);

      expect(res.body).toEqual({
        downloadSpeed: 5000,
        uploadSpeed: 100,
        activeTorrents: 2,
        sonarrQueue: 3,
        radarrQueue: 1,
        diskAvailableBytes: 40,
      });
    });

    it('nulls only the fields whose source failed', async () => {
      fetchSpy = mockUpstreams({
        ...sonarrRoutes,
        ...radarrRoutes,
        [`${QBIT_URL}/api/v2/auth/login`]: () => new Response('Fails.'),
      });

      const res = await supertest(createServer())
        .get('/media/downloads/summary')
        .expect(200);

      expect(res.body.downloadSpeed).toBeNull();
      expect(res.body.activeTorrents).toBeNull();
      expect(res.body.sonarrQueue).toBe(3);
      expect(res.body.diskAvailableBytes).toBe(40);
    });
  });
});
