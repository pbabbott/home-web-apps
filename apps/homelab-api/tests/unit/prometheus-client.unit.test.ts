import {
  getPodCpuUsage,
  getPodMemoryUsage,
} from '../../src/api/prometheus/prometheus-client';

jest.mock('../../src/config', () => ({
  config: {
    prometheusUrl: 'http://prom.local',
    prometheusQueryWindowSeconds: 300,
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: () => Promise.resolve(body),
});

describe('getPodCpuUsage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('queries the configured Prometheus URL with a rate() window', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        status: 'success',
        data: { resultType: 'vector', result: [] },
      }),
    );

    await getPodCpuUsage();

    const [calledUrl] = mockFetch.mock.calls[0];
    expect(calledUrl).toContain('http://prom.local/api/v1/query?query=');
    expect(decodeURIComponent(calledUrl)).toContain('[300s]');
  });

  it('keys results by namespace/pod', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        status: 'success',
        data: {
          resultType: 'vector',
          result: [
            {
              metric: { namespace: 'blog', pod: 'blog-abc123' },
              value: [1700000000, '0.25'],
            },
          ],
        },
      }),
    );

    const usage = await getPodCpuUsage();

    expect(usage.get('blog/blog-abc123')).toBeCloseTo(0.25);
  });

  it('returns an empty map on a non-ok response', async () => {
    mockFetch.mockResolvedValue(jsonResponse('server error', false, 500));

    await expect(getPodCpuUsage()).resolves.toEqual(new Map());
  });

  it('returns an empty map when the request throws', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));

    await expect(getPodCpuUsage()).resolves.toEqual(new Map());
  });
});

describe('getPodMemoryUsage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('keys results by namespace/pod', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        status: 'success',
        data: {
          resultType: 'vector',
          result: [
            {
              metric: { namespace: 'video-api', pod: 'video-api-xyz' },
              value: [1700000000, '104857600'],
            },
          ],
        },
      }),
    );

    const usage = await getPodMemoryUsage();

    expect(usage.get('video-api/video-api-xyz')).toBe(104857600);
  });
});
