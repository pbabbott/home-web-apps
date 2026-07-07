import { healthzRoute } from './healthz-route';

describe('healthzRoute (unit test)', () => {
  it('should return a 200 response with status: ok', async () => {
    const response = await healthzRoute();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});
