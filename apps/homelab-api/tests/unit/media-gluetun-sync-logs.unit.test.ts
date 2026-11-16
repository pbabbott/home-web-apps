import supertest from 'supertest';
import { createServer } from '../../src/server';
import { readPodLogByLabel } from '../../src/api/kubernetes/kubernetes-client';

jest.mock('../../src/api/kubernetes/kubernetes-client', () => ({
  readPodLogByLabel: jest.fn(),
}));

describe('GET /media/gluetun-sync/logs', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns the log lines, reading the gluetun-sync container with the default tail', async () => {
    (readPodLogByLabel as jest.Mock).mockResolvedValue(['one', 'two']);

    const res = await supertest(createServer())
      .get('/media/gluetun-sync/logs')
      .expect(200);

    expect(res.body).toEqual({ lines: ['one', 'two'] });
    expect(readPodLogByLabel).toHaveBeenCalledWith(
      'media',
      'api=gluetun',
      'gluetun-sync',
      200,
    );
  });

  it('passes a custom tail through', async () => {
    (readPodLogByLabel as jest.Mock).mockResolvedValue([]);

    await supertest(createServer())
      .get('/media/gluetun-sync/logs')
      .query({ tail: 50 })
      .expect(200);

    expect(readPodLogByLabel).toHaveBeenCalledWith(
      'media',
      'api=gluetun',
      'gluetun-sync',
      50,
    );
  });

  it('rejects a tail above the cap without reading logs', async () => {
    await supertest(createServer())
      .get('/media/gluetun-sync/logs')
      .query({ tail: 5000 })
      .expect(400);

    expect(readPodLogByLabel).not.toHaveBeenCalled();
  });

  it('returns 404 when there is no matching pod', async () => {
    (readPodLogByLabel as jest.Mock).mockResolvedValue(null);

    await supertest(createServer()).get('/media/gluetun-sync/logs').expect(404);
  });

  it('returns 500 when the Kubernetes API call fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    (readPodLogByLabel as jest.Mock).mockRejectedValue(new Error('forbidden'));

    await supertest(createServer()).get('/media/gluetun-sync/logs').expect(500);

    consoleErrorSpy.mockRestore();
  });
});
