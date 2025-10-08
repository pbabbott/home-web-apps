import request from 'supertest';
import { createServer } from '../src/server';

describe('Health Integration Tests', () => {
  let app: ReturnType<typeof createServer>;

  beforeAll(() => {
    app = createServer();
  });

  describe('GET /health', () => {
    it('should return 200 with health status', async () => {
      const response = await request(app).get('/healthz').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });

    it('should return proper content type', async () => {
      const response = await request(app).get('/healthz').expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });
});
