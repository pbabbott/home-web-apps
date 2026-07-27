import { metricsRoute } from './metrics-route';

describe('metricsRoute (unit test)', () => {
  it('should return a 200 response with Prometheus text format', async () => {
    const response = await metricsRoute();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/plain/);

    const body = await response.text();
    expect(body).toContain('app_up 1');
    expect(body).toContain('process_uptime_seconds');
  });
});
