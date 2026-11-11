import { Express } from 'express';
import request from 'supertest';
import { configureVersionRoute } from './version-route';
import { createTestApp } from '../../test-setup/integration-test-setup';

describe('Version Route Integration Tests', () => {
  let app: Express;
  const original = process.env['IMAGE_TAG'];

  beforeEach(() => {
    app = createTestApp();
    configureVersionRoute(app);
  });

  afterEach(() => {
    if (original === undefined) delete process.env['IMAGE_TAG'];
    else process.env['IMAGE_TAG'] = original;
  });

  it('should report IMAGE_TAG as read at request time', async () => {
    delete process.env['IMAGE_TAG'];
    const before = await request(app).get('/version').expect(200);
    expect(before.body).toEqual({ tag: 'dev' });

    process.env['IMAGE_TAG'] = '20261110-00091-00248-e2ba7c3';
    const after = await request(app).get('/version').expect(200);
    expect(after.body).toEqual({ tag: '20261110-00091-00248-e2ba7c3' });
  });

  it('should not be cached', async () => {
    const response = await request(app).get('/version').expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
