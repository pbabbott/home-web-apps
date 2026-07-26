import { Express } from 'express';
import request from 'supertest';
import { configureErrorHandler } from './error-handler';
import { createTestApp } from '../../test-setup/integration-test-setup';

describe('Error Handler Integration Tests', () => {
  let app: Express;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    app = createTestApp();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('logs and returns a generic 500 for a synchronous throw', async () => {
    app.get('/boom', () => {
      throw new Error('sync boom');
    });
    configureErrorHandler(app);

    const response = await request(app).get('/boom').expect(500);

    expect(response.body).toEqual({ message: 'Internal Server Error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('GET /boom failed'),
      expect.any(Error),
    );
  });

  it('logs and returns a generic 500 for a rejected async handler', async () => {
    app.get('/boom-async', async () => {
      throw new Error('async boom');
    });
    configureErrorHandler(app);

    const response = await request(app).get('/boom-async').expect(500);

    expect(response.body).toEqual({ message: 'Internal Server Error' });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('does not interfere with routes that succeed', async () => {
    app.get('/ok', (_, res) => res.json({ message: 'fine' }));
    configureErrorHandler(app);

    const response = await request(app).get('/ok').expect(200);

    expect(response.body).toEqual({ message: 'fine' });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
