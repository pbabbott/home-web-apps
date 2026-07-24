import { Express } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateQuery } from './validate-query';
import { createTestApp } from '../../test-setup/integration-test-setup';

describe('Validate Query Integration Tests', () => {
  let app: Express;

  const schema = z.object({
    status: z.enum(['pending', 'completed']).optional(),
  });

  beforeEach(() => {
    app = createTestApp();
    app.get('/jobs', validateQuery(schema), (req, res) =>
      res.status(200).json({ status: req.query.status ?? null }),
    );
  });

  it('passes through when the query param is omitted', async () => {
    const response = await request(app).get('/jobs').expect(200);

    expect(response.body.status).toBeNull();
  });

  it('passes through a valid status', async () => {
    const response = await request(app)
      .get('/jobs')
      .query({ status: 'pending' })
      .expect(200);

    expect(response.body.status).toBe('pending');
  });

  it('returns 400 with field errors for an invalid status', async () => {
    const response = await request(app)
      .get('/jobs')
      .query({ status: 'bogus' })
      .expect(400);

    expect(response.body.message).toBe('Invalid query parameters');
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'status' })]),
    );
  });
});
