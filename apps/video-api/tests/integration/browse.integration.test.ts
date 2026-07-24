import { getRequest } from '../jest.integration.setup';

describe('GET /browse', () => {
  it('lists the media root when no path is given', async () => {
    await getRequest()
      .get('/browse')
      .expect(200)
      .then((res) => {
        expect(res.body.entries).toEqual(
          expect.arrayContaining([
            { name: 'tv_shows', type: 'directory' },
            { name: 'movies', type: 'directory' },
          ]),
        );
      });
  });

  it('lists a subdirectory', async () => {
    await getRequest()
      .get('/browse')
      .query({ path: 'tv_shows' })
      .expect(200)
      .then((res) => {
        expect(res.body.entries).toEqual(
          expect.arrayContaining([
            { name: 'Show A', type: 'directory' },
            { name: 'notes.txt', type: 'file' },
          ]),
        );
      });
  });

  it('rejects traversal outside the media root', async () => {
    await getRequest()
      .get('/browse')
      .query({ path: '../../../../../../etc' })
      .expect(400);
  });

  it('rejects traversal buried inside a subpath', async () => {
    await getRequest()
      .get('/browse')
      .query({ path: 'tv_shows/../../../../etc/passwd' })
      .expect(400);
  });

  it('returns 404 for a directory that does not exist', async () => {
    await getRequest()
      .get('/browse')
      .query({ path: 'does_not_exist' })
      .expect(404);
  });

  it('returns 400 when path points at a file, not a directory', async () => {
    await getRequest()
      .get('/browse')
      .query({ path: 'tv_shows/notes.txt' })
      .expect(400);
  });
});
