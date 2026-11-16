import supertest from 'supertest';
import { createServer } from '../../src/server';
import { getMountpointSpace } from '../../src/api/prometheus';

jest.mock('../../src/api/prometheus', () => ({
  getMountpointSpace: jest.fn(),
}));

const TIB = 1024 ** 4;

describe('GET /media/disk-space', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns total, used, available and the used ratio', async () => {
    (getMountpointSpace as jest.Mock).mockResolvedValue({
      size: 20 * TIB,
      avail: 15 * TIB,
    });

    const res = await supertest(createServer())
      .get('/media/disk-space')
      .expect(200);

    expect(getMountpointSpace).toHaveBeenCalledWith(
      'room_of_requirement',
      '/share/Media',
    );
    expect(res.body).toEqual({
      host: 'room_of_requirement',
      mountpoint: '/share/Media',
      totalBytes: 20 * TIB,
      usedBytes: 5 * TIB,
      availableBytes: 15 * TIB,
      usedRatio: 0.25,
    });
  });

  it('returns 404 when Prometheus has no data for the mount', async () => {
    (getMountpointSpace as jest.Mock).mockResolvedValue({
      size: null,
      avail: null,
    });

    await supertest(createServer()).get('/media/disk-space').expect(404);
  });

  it('returns 500 when the query throws', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    (getMountpointSpace as jest.Mock).mockRejectedValue(new Error('boom'));

    await supertest(createServer()).get('/media/disk-space').expect(500);

    consoleErrorSpy.mockRestore();
  });
});
