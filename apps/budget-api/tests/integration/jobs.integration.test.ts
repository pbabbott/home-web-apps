import { getRequest } from '../jest.integration.setup';

describe('/jobs', () => {
  it('creates a hello job, fetches it and lists it', async () => {
    const created = await getRequest()
      .post('/jobs')
      .send({ operation: 'hello', parameters: { name: 'test' } })
      .expect(201);

    expect(created.body.status).toBe('pending');

    const fetched = await getRequest()
      .get(`/jobs/${created.body.jobId}`)
      .expect(200);

    expect(fetched.body.operation).toBe('hello');

    const listed = await getRequest().get('/jobs?status=pending').expect(200);

    expect(
      listed.body.jobs.some((j: { id: string }) => j.id === created.body.jobId),
    ).toBe(true);
  });

  it('rejects an unknown operation', async () => {
    await getRequest()
      .post('/jobs')
      .send({ operation: 'nope', parameters: {} })
      .expect(400);
  });

  it('returns 404 for an unknown job id', async () => {
    await getRequest()
      .get('/jobs/123e4567-e89b-12d3-a456-426614174000')
      .expect(404);
  });

  it('exposes ynab sync state', async () => {
    await getRequest()
      .get('/ynab/sync-state')
      .expect(200)
      .then((res) => {
        expect(Array.isArray(res.body.syncState)).toBe(true);
      });
  });
});
