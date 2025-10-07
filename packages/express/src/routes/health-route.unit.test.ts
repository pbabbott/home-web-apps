import { Express } from 'express';
import request from 'supertest';
import express from 'express';
import { configureHealthRoute } from './health-route';

describe('Health Route', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
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
  });

  describe('configureHealthRoute', () => {
    it('should configure the health endpoint on the provided Express app', () => {
      const mockApp = {
        get: jest.fn(),
      } as unknown as Express;

      configureHealthRoute(mockApp);

      expect(mockApp.get).toHaveBeenCalledWith(
        '/healthz',
        expect.any(Function),
      );
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
