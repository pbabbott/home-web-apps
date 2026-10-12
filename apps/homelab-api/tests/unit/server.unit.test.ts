import supertest from 'supertest';
import { createServer, DOCS_ROUTE } from '../../src/server';

jest.mock('../../src/services/pod-map', () => ({
  buildPodMap: jest.fn().mockResolvedValue({
    mapType: 'pods',
    metric: 'cpu',
    items: [],
    groups: null,
  }),
}));

describe('GET /healthz', () => {
  it('status check returns 200', async () => {
    await supertest(createServer())
      .get('/healthz')
      .expect(200)
      .then((res) => {
        expect(res.body.status).toBe('ok');
      });
  });
});

describe('GET /docs', () => {
  it('serves the Swagger UI', async () => {
    await supertest(createServer())
      .get(`${DOCS_ROUTE}/`)
      .expect(200)
      .then((res) => {
        expect(res.text).toContain('swagger-ui');
      });
  });
});
