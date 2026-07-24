import { getRequest } from '../jest.integration.setup';

describe('GET /readyz', () => {
  it('returns 200 when postgres is reachable', async () => {
    await getRequest()
      .get('/readyz')
      .expect(200)
      .then((res) => {
        expect(res.body.status).toBe('ok');
      });
  });
});
