import { execFile } from 'child_process';
import { getRequest } from '../jest.integration.setup';

// child_process is mocked globally in jest.integration.setup.ts (see the
// comment there); override its default stdout with a fixed runtime so
// notes.txt (not a real video) can still stand in for the ffprobe call.
(execFile as unknown as jest.Mock).mockImplementation(
  (
    _file: string,
    _args: string[],
    callback: (err: Error | null, result?: unknown) => void,
  ) => callback(null, { stdout: '659.600000\n', stderr: '' }),
);

describe('GET /run-time', () => {
  const filePath = '/tv_shows/notes.txt';

  it('returns the probed runtime, rounded to whole seconds', async () => {
    await getRequest()
      .get('/run-time')
      .query({ filePath })
      .expect(200)
      .then((res) => {
        expect(res.body).toEqual({ filePath, runTimeSeconds: 660 });
      });
  });

  it('rejects a filePath that escapes MEDIA_ROOT', async () => {
    await getRequest()
      .get('/run-time')
      .query({ filePath: '../../etc/passwd' })
      .expect(400);
  });

  it('returns 404 for a nonexistent file', async () => {
    await getRequest()
      .get('/run-time')
      .query({ filePath: '/tv_shows/does-not-exist.mp4' })
      .expect(404);
  });

  it('rejects a missing filePath', async () => {
    await getRequest().get('/run-time').expect(400);
  });
});
