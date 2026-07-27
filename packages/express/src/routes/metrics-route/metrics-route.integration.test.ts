import { Express } from 'express';
import request from 'supertest';
import { configureMetricsRoute } from './metrics-route';
import { createTestApp } from '../../test-setup/integration-test-setup';

describe('Metrics Route Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    configureMetricsRoute(app);
  });

  describe('GET /metrics', () => {
    it('should return 200 status with Prometheus text format', async () => {
      const response = await request(app).get('/metrics').expect(200);

      expect(response.text).toContain('app_up 1');
      expect(response.text).toContain('process_uptime_seconds');
    });

    it('should return the Prometheus exposition content type', async () => {
      const response = await request(app).get('/metrics').expect(200);

      expect(response.headers['content-type']).toMatch(/text\/plain/);
    });

    it('should not interfere with other routes', async () => {
      app.get('/other', (_, res) => res.json({ message: 'other' }));

      await request(app).get('/metrics').expect(200);

      const otherResponse = await request(app).get('/other').expect(200);

      expect(otherResponse.body).toEqual({ message: 'other' });
    });
  });
});
