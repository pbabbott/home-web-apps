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

  it('lists raw response metadata without payloads', async () => {
    await getRequest()
      .get('/ynab/raw-responses?limit=5&endpoint=transactions')
      .expect(200)
      .then((res) => {
        expect(Array.isArray(res.body.rawResponses)).toBe(true);
        for (const row of res.body.rawResponses) {
          expect(row).not.toHaveProperty('payload');
          expect(typeof row.payloadBytes).toBe('number');
        }
      });
  });

  it('rejects an invalid raw-responses query', async () => {
    await getRequest().get('/ynab/raw-responses?limit=9999').expect(400);
  });

  it('exposes ynab plans and sync runs', async () => {
    await getRequest()
      .get('/ynab/plans')
      .expect(200)
      .then((res) => expect(Array.isArray(res.body.plans)).toBe(true));

    await getRequest()
      .get('/ynab/sync-runs')
      .expect(200)
      .then((res) => {
        expect(Array.isArray(res.body.syncRuns)).toBe(true);
        for (const run of res.body.syncRuns) {
          expect(typeof run.totalBytes).toBe('number');
        }
      });
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
