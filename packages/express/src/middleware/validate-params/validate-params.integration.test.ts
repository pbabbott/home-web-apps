import { Express } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateParams } from './validate-params';
import { createTestApp } from '../../test-setup/integration-test-setup';

describe('Validate Params Integration Tests', () => {
  let app: Express;

  const schema = z.object({ id: z.uuid() });

  beforeEach(() => {
    app = createTestApp();
    app.get('/jobs/:id', validateParams(schema), (req, res) =>
      res.status(200).json({ id: req.params.id }),
    );
  });

  it('passes a valid uuid through to the handler', async () => {
    const id = '123e4567-e89b-12d3-a456-426614174000';

    const response = await request(app).get(`/jobs/${id}`).expect(200);

    expect(response.body.id).toBe(id);
  });

  it('returns 400 with field errors for a non-uuid id', async () => {
    const response = await request(app).get('/jobs/not-a-uuid').expect(400);

    expect(response.body.message).toBe('Invalid request parameters');
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'id' })]),
    );
  });
});
