import supertest from 'supertest';
import { createServer } from '../../src/server';
import { buildPodMap } from '../../src/services/pod-map';

jest.mock('../../src/services/pod-map', () => ({
  buildPodMap: jest.fn(),
}));

describe('GET /maps/:type', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  it('rejects an unsupported map type without calling the service', async () => {
    const res = await supertest(createServer())
      .get('/maps/deployments')
      .query({ metric: 'cpu' })
      .expect(400);

    expect(res.body.message).toBe('Invalid request parameters');
    expect(buildPodMap).not.toHaveBeenCalled();
  });

  it('rejects a missing metric', async () => {
    const res = await supertest(createServer()).get('/maps/pods').expect(400);

    expect(res.body.message).toBe('Invalid query parameters');
    expect(buildPodMap).not.toHaveBeenCalled();
  });

  it('rejects an unsupported groupBy value', async () => {
    const res = await supertest(createServer())
      .get('/maps/pods')
      .query({ metric: 'cpu', groupBy: 'bogus' })
      .expect(400);

    expect(res.body.message).toBe('Invalid query parameters');
    expect(buildPodMap).not.toHaveBeenCalled();
  });

  it('passes metric and groupBy through to buildPodMap', async () => {
    (buildPodMap as jest.Mock).mockResolvedValue({
      mapType: 'pods',
      metric: 'both',
      items: [],
      groups: [],
    });

    await supertest(createServer())
      .get('/maps/pods')
      .query({ metric: 'both', groupBy: 'node' })
      .expect(200);

    expect(buildPodMap).toHaveBeenCalledWith('both', 'node');
  });

  it('omits groupBy when not provided', async () => {
    (buildPodMap as jest.Mock).mockResolvedValue({
      mapType: 'pods',
      metric: 'cpu',
      items: [],
      groups: null,
    });

    await supertest(createServer())
      .get('/maps/pods')
      .query({ metric: 'cpu' })
      .expect(200);

    expect(buildPodMap).toHaveBeenCalledWith('cpu', undefined);
  });

  it('logs the error and returns a generic message when the service fails', async () => {
    const err = new Error('k8s unreachable');
    (buildPodMap as jest.Mock).mockRejectedValue(err);

    const res = await supertest(createServer())
      .get('/maps/pods')
      .query({ metric: 'cpu' })
      .expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('GET /maps/pods failed:', err);
  });
});
