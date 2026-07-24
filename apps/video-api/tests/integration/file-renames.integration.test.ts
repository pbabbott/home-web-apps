import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getRequest, MEDIA_ROOT } from '../jest.integration.setup';

describe('file-renames', () => {
  const filePath = '/movies/rename-me.txt';
  const absPath = path.join(MEDIA_ROOT, 'movies', 'rename-me.txt');

  beforeAll(() => {
    fs.writeFileSync(absPath, 'a video file, pretend');
  });

  const expectedHash = () =>
    crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');

  describe('POST /file-renames', () => {
    it('hashes originalFilePath and creates a pending suggestion', async () => {
      await getRequest()
        .post('/file-renames')
        .send({
          originalFilePath: filePath,
          suggestedFilePath: '/movies/Renamed Movie (2020).mp4',
        })
        .expect(201)
        .then((res) => {
          expect(res.body.fileHash).toBe(expectedHash());
          expect(res.body.originalFilePath).toBe(filePath);
          expect(res.body.suggestedFilePath).toBe(
            '/movies/Renamed Movie (2020).mp4',
          );
          expect(res.body.status).toBe('pending');
          expect(res.body.appliedAt).toBeNull();
        });
    });

    it('updates the existing suggestion and resets status to pending', async () => {
      const created = await getRequest().post('/file-renames').send({
        originalFilePath: filePath,
        suggestedFilePath: '/movies/First Guess.mp4',
      });

      await getRequest()
        .patch(`/file-renames/${created.body.id}`)
        .send({ status: 'applied' })
        .expect(200);

      const second = await getRequest()
        .post('/file-renames')
        .send({
          originalFilePath: filePath,
          suggestedFilePath: '/movies/Better Guess.mp4',
        })
        .expect(201);

      expect(second.body.id).toBe(created.body.id);
      expect(second.body.suggestedFilePath).toBe('/movies/Better Guess.mp4');
      expect(second.body.status).toBe('pending');
      expect(second.body.appliedAt).toBeNull();
    });

    it('rejects a suggestedFilePath that escapes MEDIA_ROOT', async () => {
      await getRequest()
        .post('/file-renames')
        .send({
          originalFilePath: filePath,
          suggestedFilePath: '../../etc/passwd',
        })
        .expect(400);
    });

    it('returns 404 for a nonexistent originalFilePath', async () => {
      await getRequest()
        .post('/file-renames')
        .send({
          originalFilePath: '/movies/does-not-exist.mp4',
          suggestedFilePath: '/movies/whatever.mp4',
        })
        .expect(404);
    });

    it('survives the original file being renamed on disk', async () => {
      const created = await getRequest().post('/file-renames').send({
        originalFilePath: filePath,
        suggestedFilePath: '/movies/Renamed Movie (2020).mp4',
      });

      const renamedAbsPath = path.join(
        MEDIA_ROOT,
        'movies',
        'actually-renamed.txt',
      );
      fs.renameSync(absPath, renamedAbsPath);

      try {
        await getRequest()
          .get('/file-renames')
          .query({ fileHash: created.body.fileHash })
          .expect(200)
          .then((res) => {
            const ids = res.body.fileRenames.map((fr: { id: string }) => fr.id);
            expect(ids).toContain(created.body.id);
          });
      } finally {
        fs.renameSync(renamedAbsPath, absPath);
      }
    });
  });

  describe('GET /file-renames/:id', () => {
    it('returns the record for a known id', async () => {
      const created = await getRequest().post('/file-renames').send({
        originalFilePath: filePath,
        suggestedFilePath: '/movies/Renamed Movie (2020).mp4',
      });

      await getRequest()
        .get(`/file-renames/${created.body.id}`)
        .expect(200)
        .then((res) => {
          expect(res.body.id).toBe(created.body.id);
        });
    });

    it('returns 404 for an unknown id', async () => {
      await getRequest()
        .get('/file-renames/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PATCH /file-renames/:id', () => {
    it('marks a suggestion applied and stamps appliedAt', async () => {
      const created = await getRequest().post('/file-renames').send({
        originalFilePath: filePath,
        suggestedFilePath: '/movies/Renamed Movie (2020).mp4',
      });

      await getRequest()
        .patch(`/file-renames/${created.body.id}`)
        .send({ status: 'applied' })
        .expect(200)
        .then((res) => {
          expect(res.body.status).toBe('applied');
          expect(res.body.appliedAt).not.toBeNull();
        });
    });

    it('clears appliedAt when marked rejected', async () => {
      const created = await getRequest().post('/file-renames').send({
        originalFilePath: filePath,
        suggestedFilePath: '/movies/Renamed Movie (2020).mp4',
      });

      await getRequest()
        .patch(`/file-renames/${created.body.id}`)
        .send({ status: 'applied' });

      await getRequest()
        .patch(`/file-renames/${created.body.id}`)
        .send({ status: 'rejected' })
        .expect(200)
        .then((res) => {
          expect(res.body.status).toBe('rejected');
          expect(res.body.appliedAt).toBeNull();
        });
    });

    it('rejects an unsupported status', async () => {
      const created = await getRequest().post('/file-renames').send({
        originalFilePath: filePath,
        suggestedFilePath: '/movies/Renamed Movie (2020).mp4',
      });

      await getRequest()
        .patch(`/file-renames/${created.body.id}`)
        .send({ status: 'bogus' })
        .expect(400);
    });

    it('returns 404 for an unknown id', async () => {
      await getRequest()
        .patch('/file-renames/00000000-0000-0000-0000-000000000000')
        .send({ status: 'applied' })
        .expect(404);
    });
  });

  describe('GET /file-renames', () => {
    it('filters by status', async () => {
      const created = await getRequest().post('/file-renames').send({
        originalFilePath: filePath,
        suggestedFilePath: '/movies/Status Filter Test.mp4',
      });

      await getRequest()
        .patch(`/file-renames/${created.body.id}`)
        .send({ status: 'applied' });

      await getRequest()
        .get('/file-renames')
        .query({ status: 'applied' })
        .expect(200)
        .then((res) => {
          const ids = res.body.fileRenames.map((fr: { id: string }) => fr.id);
          expect(ids).toContain(created.body.id);
          res.body.fileRenames.forEach((fr: { status: string }) =>
            expect(fr.status).toBe('applied'),
          );
        });
    });

    it('rejects an unsupported status filter', async () => {
      await getRequest()
        .get('/file-renames')
        .query({ status: 'bogus' })
        .expect(400);
    });
  });
});
