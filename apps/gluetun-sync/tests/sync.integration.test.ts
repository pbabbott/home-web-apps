import { getRequest } from './jest.integration.setup';

describe('sync', () => {
  describe('pre-sync', () => {
    it('should return empty object for GET /status', async () => {
      await getRequest()
        .get('/status')
        .expect(200)
        .then((res) => {
          expect(res.status).toBe(200);
          expect(res.body.result).toStrictEqual({});
        });
    });
  });
  describe('do sync', () => {
    it('should return 200 for POST /sync', async () => {
      // This will test connectivity to both Gluetun and qBitTorrent
      await getRequest()
        .post('/sync')
        .expect(200)
        .then((res) => {
          expect(res.status).toBe(200);
          expect(res.body.message).toBeTruthy();
        });
    });
    it('should return a sensible response for GET /status', async () => {
      // This will verify that the port sync was successful
      await getRequest()
        .get('/status')
        .expect(200)
        .then((res) => {
          expect(res.status).toBe(200);
          expect(res.body).toBeDefined();
          expect(res.body.result.mostRecentAttemptSuccessful).toBeTruthy();
          expect(res.body.result.lastAttemptBy).toBe('API');
        });
    });
  });
});
