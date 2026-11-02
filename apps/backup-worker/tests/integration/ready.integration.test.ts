import { getRequest } from '../jest.integration.setup';

describe('GET /readyz and /healthz', () => {
  it('/readyz returns 200 when postgres is reachable', async () => {
    await getRequest()
      .get('/readyz')
      .expect(200)
      .then((res) => {
        expect(res.body.status).toBe('ok');
      });
  });

  it('/healthz returns 200', async () => {
    await getRequest().get('/healthz').expect(200);
  });
});
