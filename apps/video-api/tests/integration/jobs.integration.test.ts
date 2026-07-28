import { getRequest } from '../jest.integration.setup';

describe('jobs', () => {
  describe('POST /jobs', () => {
    it('creates a pending paw_patrol_title_cards job', async () => {
      await getRequest()
        .post('/jobs')
        .send({
          operation: 'paw_patrol_title_cards',
          parameters: { seasonNumber: 3 },
        })
        .expect(201)
        .then((res) => {
          expect(res.body.jobId).toBeTruthy();
          expect(res.body.status).toBe('pending');
        });
    });

    it('rejects an unsupported operation', async () => {
      await getRequest()
        .post('/jobs')
        .send({
          operation: 'transcode',
        })
        .expect(400)
        .then((res) => {
          expect(res.body.message).toBe('Invalid request body');
          expect(res.body.errors).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'operation' }),
            ]),
          );
        });
    });

    it('rejects a missing seasonNumber', async () => {
      await getRequest()
        .post('/jobs')
        .send({ operation: 'paw_patrol_title_cards', parameters: {} })
        .expect(400)
        .then((res) => {
          expect(res.body.errors).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'parameters.seasonNumber' }),
            ]),
          );
        });
    });
  });

  describe('GET /jobs/:id', () => {
    it('returns the job for a known id', async () => {
      const created = await getRequest()
        .post('/jobs')
        .send({
          operation: 'paw_patrol_title_cards',
          parameters: { seasonNumber: 3 },
        });

      await getRequest()
        .get(`/jobs/${created.body.jobId}`)
        .expect(200)
        .then((res) => {
          expect(res.body.id).toBe(created.body.jobId);
          expect(res.body.parameters).toEqual({ seasonNumber: 3 });
          expect(res.body.status).toBe('pending');
        });
    });

    it('returns 404 for an unknown id', async () => {
      await getRequest()
        .get('/jobs/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('returns 400, not 500, for a malformed id', async () => {
      await getRequest()
        .get('/jobs/not-a-uuid')
        .expect(400)
        .then((res) => {
          expect(res.body.message).toBe('Invalid request parameters');
          expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'id' })]),
          );
        });
    });
  });

  describe('GET /jobs', () => {
    it('lists a newly created job when no status filter is given', async () => {
      const created = await getRequest()
        .post('/jobs')
        .send({
          operation: 'paw_patrol_title_cards',
          parameters: { seasonNumber: 1 },
        });

      await getRequest()
        .get('/jobs')
        .expect(200)
        .then((res) => {
          const ids = res.body.jobs.map((j: { id: string }) => j.id);
          expect(ids).toContain(created.body.jobId);
        });
    });

    it('includes a newly created job when filtered by status=pending', async () => {
      const created = await getRequest()
        .post('/jobs')
        .send({
          operation: 'paw_patrol_title_cards',
          parameters: { seasonNumber: 2 },
        });

      await getRequest()
        .get('/jobs')
        .query({ status: 'pending' })
        .expect(200)
        .then((res) => {
          const ids = res.body.jobs.map((j: { id: string }) => j.id);
          expect(ids).toContain(created.body.jobId);
          res.body.jobs.forEach((job: { status: string }) => {
            expect(job.status).toBe('pending');
          });
        });
    });

    it('excludes a newly created (pending) job when filtered by a different status', async () => {
      const created = await getRequest()
        .post('/jobs')
        .send({
          operation: 'paw_patrol_title_cards',
          parameters: { seasonNumber: 4 },
        });

      await getRequest()
        .get('/jobs')
        .query({ status: 'failed' })
        .expect(200)
        .then((res) => {
          const ids = res.body.jobs.map((j: { id: string }) => j.id);
          expect(ids).not.toContain(created.body.jobId);
        });
    });

    it('orders results by most recently created first', async () => {
      const first = await getRequest()
        .post('/jobs')
        .send({
          operation: 'paw_patrol_title_cards',
          parameters: { seasonNumber: 5 },
        });
      const second = await getRequest()
        .post('/jobs')
        .send({
          operation: 'paw_patrol_title_cards',
          parameters: { seasonNumber: 6 },
        });

      await getRequest()
        .get('/jobs')
        .expect(200)
        .then((res) => {
          const ids = res.body.jobs.map((j: { id: string }) => j.id);
          const firstIndex = ids.indexOf(first.body.jobId);
          const secondIndex = ids.indexOf(second.body.jobId);
          expect(secondIndex).toBeLessThan(firstIndex);
        });
    });

    it('rejects an unsupported status', async () => {
      await getRequest()
        .get('/jobs')
        .query({ status: 'bogus' })
        .expect(400)
        .then((res) => {
          expect(res.body.message).toBe('Invalid query parameters');
          expect(res.body.errors).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'status' }),
            ]),
          );
        });
    });
  });
});
