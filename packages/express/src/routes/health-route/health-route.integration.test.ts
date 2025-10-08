import { Express } from 'express';
import request from 'supertest';
import { configureHealthRoute } from './health-route';
import { createTestApp } from '../../test-setup/integration-test-setup';

describe('Health Route Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    configureHealthRoute(app);
  });

  describe('GET /healthz', () => {
    it('should return 200 status with ok: true', async () => {
      const response = await request(app).get('/healthz').expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it('should return JSON content type', async () => {
      const response = await request(app).get('/healthz').expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should handle multiple requests', async () => {
      // Test that the endpoint works consistently across multiple calls
      const promises = Array.from({ length: 5 }, () =>
        request(app).get('/healthz').expect(200),
      );

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.body).toEqual({ ok: true });
      });
    });

    it('should not interfere with other routes', async () => {
      // Add another route to ensure health route doesn't interfere
      app.get('/other', (_, res) => res.json({ message: 'other' }));

      const healthResponse = await request(app).get('/healthz').expect(200);

      expect(healthResponse.body).toEqual({ ok: true });

      // The other route should still work
      const otherResponse = await request(app).get('/other').expect(200);

      expect(otherResponse.body).toEqual({ message: 'other' });
    });
  });
});
