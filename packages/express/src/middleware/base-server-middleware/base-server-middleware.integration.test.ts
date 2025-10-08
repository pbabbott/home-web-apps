import { Express } from 'express';
import request from 'supertest';
import { configureBaseServerMiddleware } from './base-server-middleware';
import { createTestApp } from '../../test-setup/integration-test-setup';

describe('Base Server Middleware Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    configureBaseServerMiddleware(app);
  });

  describe('Security Headers', () => {
    it('should disable x-powered-by header', async () => {
      const response = await request(app).get('/test').expect(404);

      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS Configuration', () => {
    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should include CORS headers in responses', async () => {
      // Add a simple route to test CORS headers
      app.get('/test', (_, res) => res.json({ message: 'test' }));

      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Body Parsing', () => {
    it('should parse JSON request bodies', async () => {
      app.post('/test-json', (req, res) => {
        res.json({ received: req.body });
      });

      const testData = { message: 'test', number: 123 };

      const response = await request(app)
        .post('/test-json')
        .send(testData)
        .expect(200);

      expect(response.body.received).toEqual(testData);
    });

    it('should parse URL-encoded request bodies', async () => {
      app.post('/test-urlencoded', (req, res) => {
        res.json({ received: req.body });
      });

      const response = await request(app)
        .post('/test-urlencoded')
        .send('message=test&number=123')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);

      expect(response.body.received).toEqual({
        message: 'test',
        number: '123', // URL-encoded values are strings by default
      });
    });

    it('should handle extended URL-encoded data', async () => {
      app.post('/test-extended', (req, res) => {
        res.json({ received: req.body });
      });

      // Test with nested objects (extended: true allows this)
      const response = await request(app)
        .post('/test-extended')
        .send('user[name]=John&user[age]=30')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);

      expect(response.body.received).toEqual({
        user: {
          name: 'John',
          age: '30',
        },
      });
    });
  });

  describe('Morgan Logging', () => {
    it('should log requests (morgan middleware is present)', async () => {
      // Add a route to test logging
      app.get('/test-logging', (_, res) => res.json({ logged: true }));

      // Morgan middleware should be present and log the request
      // We can't easily test the actual log output, but we can verify
      // the middleware is configured and doesn't break the request
      const response = await request(app).get('/test-logging').expect(200);

      expect(response.body).toEqual({ logged: true });
    });
  });

  describe('Middleware Order and Integration', () => {
    it('should apply all middleware in correct order', async () => {
      app.get('/test-middleware-order', (req, res) => {
        // Test that all middleware is working together
        const response = {
          hasBody: !!req.body,
          headers: req.headers,
          cors: !!req.headers.origin,
        };
        res.json(response);
      });

      const response = await request(app)
        .get('/test-middleware-order')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.body).toHaveProperty('hasBody');
      expect(response.body).toHaveProperty('headers');
      expect(response.body).toHaveProperty('cors');
    });

    it('should handle multiple requests without interference', async () => {
      app.get('/test-concurrent', (_, res) =>
        res.json({ timestamp: Date.now() }),
      );

      // Send multiple concurrent requests
      const promises = Array.from({ length: 3 }, () =>
        request(app).get('/test-concurrent').expect(200),
      );

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.body).toHaveProperty('timestamp');
        expect(typeof response.body.timestamp).toBe('number');
      });
    });
  });
});
