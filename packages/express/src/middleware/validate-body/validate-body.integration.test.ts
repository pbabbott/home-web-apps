import { Express } from 'express';
import request from 'supertest';
import { json } from 'body-parser';
import { z } from 'zod';
import { validateBody } from './validate-body';
import { createTestApp } from '../../test-setup/integration-test-setup';

describe('Validate Body Integration Tests', () => {
  let app: Express;

  const schema = z.object({
    operation: z.enum(['screenshots']),
    inputPath: z.string().min(1),
    parameters: z.object({
      timestamps: z.array(z.number()).min(1),
    }),
  });

  beforeEach(() => {
    app = createTestApp();
    app.use(json());
    app.post('/jobs', validateBody(schema), (req, res) =>
      res.status(201).json(req.body),
    );
  });

  it('passes a fully valid body through to the handler', async () => {
    const response = await request(app)
      .post('/jobs')
      .send({
        operation: 'screenshots',
        inputPath: '/videos/example.mp4',
        parameters: { timestamps: [30, 120, 300] },
      })
      .expect(201);

    expect(response.body.operation).toBe('screenshots');
  });

  it('reports every missing/invalid field at once, not just the first', async () => {
    const response = await request(app)
      .post('/jobs')
      .send({ operation: 'transcode' })
      .expect(400);

    expect(response.body.message).toBe('Invalid request body');

    const fields = response.body.errors.map((e: { field: string }) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining(['operation', 'inputPath', 'parameters']),
    );
  });

  it('reports a nested field path for invalid parameters', async () => {
    const response = await request(app)
      .post('/jobs')
      .send({
        operation: 'screenshots',
        inputPath: '/videos/example.mp4',
        parameters: { timestamps: [] },
      })
      .expect(400);

    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'parameters.timestamps' }),
      ]),
    );
  });
});
