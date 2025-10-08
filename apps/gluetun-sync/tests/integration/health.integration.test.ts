import { getRequest } from '../jest.integration.setup';

describe('GET /healthz', () => {
  it('status check returns 200', async () => {
    await getRequest()
      .get('/healthz')
      .expect(200)
      .then((res) => {
        expect(res.body.ok).toBe(true);
      });
  });
});
