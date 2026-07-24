import { getRequest } from '../jest.integration.setup';

describe('jobs', () => {
  describe('POST /jobs', () => {
    it('creates a pending screenshots job', async () => {
      await getRequest()
        .post('/jobs')
        .send({
          operation: 'screenshots',
          inputPath: '/mnt/nas/videos/example.mp4',
          parameters: { timestamps: [30, 120, 300] },
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
          inputPath: '/mnt/nas/videos/example.mp4',
        })
        .expect(400);
    });

    it('rejects a missing inputPath', async () => {
      await getRequest()
        .post('/jobs')
        .send({ operation: 'screenshots', parameters: { timestamps: [30] } })
        .expect(400);
    });

    it('rejects missing timestamps for screenshots', async () => {
      await getRequest()
        .post('/jobs')
        .send({
          operation: 'screenshots',
          inputPath: '/mnt/nas/videos/example.mp4',
          parameters: {},
        })
        .expect(400);
    });
  });

  describe('GET /jobs/:id', () => {
    it('returns the job for a known id', async () => {
      const created = await getRequest()
        .post('/jobs')
        .send({
          operation: 'screenshots',
          inputPath: '/mnt/nas/videos/example.mp4',
          parameters: { timestamps: [30] },
        });

      await getRequest()
        .get(`/jobs/${created.body.jobId}`)
        .expect(200)
        .then((res) => {
          expect(res.body.id).toBe(created.body.jobId);
          expect(res.body.inputPath).toBe('/mnt/nas/videos/example.mp4');
          expect(res.body.status).toBe('pending');
        });
    });

    it('returns 404 for an unknown id', async () => {
      await getRequest()
        .get('/jobs/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });
});
