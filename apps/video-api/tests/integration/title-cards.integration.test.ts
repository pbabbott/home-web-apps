import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getRequest, MEDIA_ROOT } from '../jest.integration.setup';

describe('title-cards', () => {
  const filePath = '/tv_shows/notes.txt';
  const expectedHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(MEDIA_ROOT, 'tv_shows', 'notes.txt')))
    .digest('hex');

  describe('POST /title-cards', () => {
    it('hashes the file and creates a title card', async () => {
      await getRequest()
        .post('/title-cards')
        .send({ filePath, timestampSeconds: 128, title: 'Pups Save a Toof' })
        .expect(201)
        .then((res) => {
          expect(res.body.fileHash).toBe(expectedHash);
          expect(res.body.filePath).toBe(filePath);
          expect(res.body.timestampSeconds).toBe(128);
          expect(res.body.title).toBe('Pups Save a Toof');
        });
    });

    it('updates the existing record instead of erroring on a repeat submission', async () => {
      const first = await getRequest()
        .post('/title-cards')
        .send({ filePath, timestampSeconds: 200 });

      const second = await getRequest()
        .post('/title-cards')
        .send({ filePath, timestampSeconds: 200, title: 'Updated Title' })
        .expect(201);

      expect(second.body.id).toBe(first.body.id);
      expect(second.body.title).toBe('Updated Title');
    });

    it('rejects a filePath that escapes MEDIA_ROOT', async () => {
      await getRequest()
        .post('/title-cards')
        .send({ filePath: '../../etc/passwd', timestampSeconds: 30 })
        .expect(400);
    });

    it('returns 404 for a nonexistent file', async () => {
      await getRequest()
        .post('/title-cards')
        .send({
          filePath: '/tv_shows/does-not-exist.mp4',
          timestampSeconds: 30,
        })
        .expect(404);
    });

    it('rejects a negative timestampSeconds', async () => {
      await getRequest()
        .post('/title-cards')
        .send({ filePath, timestampSeconds: -5 })
        .expect(400)
        .then((res) => {
          expect(res.body.errors).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'timestampSeconds' }),
            ]),
          );
        });
    });
  });

  describe('GET /title-cards/:id', () => {
    it('returns the record for a known id', async () => {
      const created = await getRequest()
        .post('/title-cards')
        .send({ filePath, timestampSeconds: 333 });

      await getRequest()
        .get(`/title-cards/${created.body.id}`)
        .expect(200)
        .then((res) => {
          expect(res.body.id).toBe(created.body.id);
        });
    });

    it('returns 404 for an unknown id', async () => {
      await getRequest()
        .get('/title-cards/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('GET /title-cards', () => {
    it('lists by fileHash', async () => {
      await getRequest()
        .post('/title-cards')
        .send({ filePath, timestampSeconds: 400 });

      await getRequest()
        .get('/title-cards')
        .query({ fileHash: expectedHash })
        .expect(200)
        .then((res) => {
          const timestamps = res.body.titleCards.map(
            (tc: { timestampSeconds: number }) => tc.timestampSeconds,
          );
          expect(timestamps).toContain(400);
        });
    });

    it('lists by filePath, resolving+hashing the same way POST does', async () => {
      await getRequest()
        .get('/title-cards')
        .query({ filePath })
        .expect(200)
        .then((res) => {
          expect(res.body.titleCards.length).toBeGreaterThan(0);
          res.body.titleCards.forEach((tc: { fileHash: string }) =>
            expect(tc.fileHash).toBe(expectedHash),
          );
        });
    });
  });
});
