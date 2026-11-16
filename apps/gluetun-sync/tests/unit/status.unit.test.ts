import supertest from 'supertest';
import { createServer } from '../../src/server';
import { PortsResult } from '../../src/controllers/get-ports';
import * as gluetunApi from '../../src/api/gluetun/gluetun';
import * as qbittorrentApi from '../../src/api/qbittorrent';

jest.mock('../../src/api/gluetun/gluetun');
jest.mock('../../src/api/qbittorrent');
jest.mock('../../src/config', () => ({
  config: {
    gluetun: { apiHost: 'http://gluetun.test' },
    qbitTorrent: { apiHost: 'http://qbittorrent.test' },
  },
}));

describe('GET /status', () => {
  it('status check returns 200', async () => {
    await supertest(createServer())
      .get('/status')
      .expect(200)
      .then((res) => {
        expect(res.body.result).toBeDefined();
      });
  });
});

describe('GET /status/ports (mocked api responses)', () => {
  let result: PortsResult = null;
  const expectedGluetunPort = '12345';
  const expectedQbitTorrentPort = '54321';

  beforeAll(async () => {
    // Mock the getForwardedPort function
    (gluetunApi.getForwardedPort as jest.Mock).mockResolvedValue({
      port: expectedGluetunPort,
    });
    (qbittorrentApi.login as jest.Mock).mockResolvedValue('token');
    (qbittorrentApi.getApplicationPreferences as jest.Mock).mockResolvedValue({
      listen_port: expectedQbitTorrentPort,
    });

    await supertest(createServer())
      .get('/status/ports')
      .expect(200)
      .then((res) => {
        result = res.body.result;
      });
  });

  it('should have a body', () => {
    expect(result).toBeDefined();
  });
  it('should have a gluetun port', async () => {
    expect(result.gluetunPort).toBe(expectedGluetunPort);
  });
  it('should have a qbitTorrent port', async () => {
    expect(result.qbitTorrentPort).toBe(expectedQbitTorrentPort);
  });
});

describe('GET /status/public-ip (mocked api responses)', () => {
  it('returns the ip and location from gluetun', async () => {
    (gluetunApi.getPublicIpInfo as jest.Mock).mockResolvedValue({
      public_ip: '149.36.49.159',
      region: 'Ontario',
      country: 'Canada',
      city: 'Toronto',
    });

    await supertest(createServer())
      .get('/status/public-ip')
      .expect(200)
      .then((res) => {
        expect(res.body.result).toEqual({
          ip: '149.36.49.159',
          region: 'Ontario',
          country: 'Canada',
          city: 'Toronto',
        });
      });
  });

  it('returns 503 when neither gluetun nor ipify has an ip', async () => {
    (gluetunApi.getPublicIpInfo as jest.Mock).mockResolvedValue(null);
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('offline'));

    await supertest(createServer()).get('/status/public-ip').expect(503);

    fetchSpy.mockRestore();
  });
});

describe('GET /status/services', () => {
  it('reports each service by whether it answered with a 200', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (input) =>
        String(input).includes('/v1/portforward')
          ? new Response('{}', { status: 200 })
          : new Response('nope', { status: 500 }),
      );

    await supertest(createServer())
      .get('/status/services')
      .expect(200)
      .then((res) => {
        expect(res.body.result).toEqual({
          gluetun: true,
          qbittorrent: false,
        });
      });

    fetchSpy.mockRestore();
  });
});
