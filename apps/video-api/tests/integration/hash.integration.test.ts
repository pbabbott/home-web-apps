import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getRequest, MEDIA_ROOT } from '../jest.integration.setup';

describe('GET /hash', () => {
  const filePath = '/tv_shows/notes.txt';
  const expectedHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(MEDIA_ROOT, 'tv_shows', 'notes.txt')))
    .digest('hex');

  it('returns the SHA-256 hash of the file', async () => {
    await getRequest()
      .get('/hash')
      .query({ filePath })
      .expect(200)
      .then((res) => {
        expect(res.body).toEqual({ filePath, fileHash: expectedHash });
      });
  });

  it('rejects a filePath that escapes MEDIA_ROOT', async () => {
    await getRequest()
      .get('/hash')
      .query({ filePath: '../../etc/passwd' })
      .expect(400);
  });

  it('returns 404 for a nonexistent file', async () => {
    await getRequest()
      .get('/hash')
      .query({ filePath: '/tv_shows/does-not-exist.mp4' })
      .expect(404);
  });

  it('rejects a missing filePath', async () => {
    await getRequest().get('/hash').expect(400);
  });
});
