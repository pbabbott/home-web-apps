import supertest from 'supertest';
import { createServer } from '../../src/server';
import * as service from '../../src/services/discovery';

jest.mock('../../src/services/discovery', () => {
  const actual = jest.requireActual('../../src/services/discovery');

  return {
    DiscoveryError: actual.DiscoveryError,
    createBackupSource: jest.fn(),
    listBackupSources: jest.fn(),
    createDiscoveryJob: jest.fn(),
    getDiscoveryJob: jest.fn(),
    completeJob: jest.fn(),
    cancelJob: jest.fn(),
    failJob: jest.fn(),
    enqueuePaths: jest.fn(),
    claimQueueItem: jest.fn(),
    listSourceQueueItems: jest.fn(),
    listSourceJobs: jest.fn(),
    heartbeat: jest.fn(),
    completeItem: jest.fn(),
    failItem: jest.fn(),
    skipItem: jest.fn(),
    retryItem: jest.fn(),
  };
});

const mocked = jest.mocked(service);
const ID = '123e4567-e89b-12d3-a456-426614174000';
const HOST_ID = '323e4567-e89b-12d3-a456-426614174000';
const TOKEN = '223e4567-e89b-12d3-a456-426614174000';

describe('discovery routes', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  describe('POST /backup-sources', () => {
    it('defaults sourceType to windows', async () => {
      mocked.createBackupSource.mockResolvedValue({ id: ID } as never);

      await supertest(createServer())
        .post('/backup-sources')
        .send({ name: 'win11-desktop', hostId: HOST_ID })
        .expect(201);

      expect(mocked.createBackupSource).toHaveBeenCalledWith({
        name: 'win11-desktop',
        hostId: HOST_ID,
        sourceType: 'windows',
      });
    });

    it('accepts a missing hostId', async () => {
      mocked.createBackupSource.mockResolvedValue({ id: ID } as never);

      await supertest(createServer())
        .post('/backup-sources')
        .send({ name: 'win11-desktop' })
        .expect(201);

      expect(mocked.createBackupSource).toHaveBeenCalledWith({
        name: 'win11-desktop',
        sourceType: 'windows',
      });
    });

    it('rejects a non-uuid hostId', async () => {
      await supertest(createServer())
        .post('/backup-sources')
        .send({ name: 'win11-desktop', hostId: 'ELDERWAND' })
        .expect(400);
    });

    it('maps an unknown host to 404', async () => {
      mocked.createBackupSource.mockRejectedValue(
        new service.DiscoveryError('not_found', 'host not found'),
      );

      await supertest(createServer())
        .post('/backup-sources')
        .send({ name: 'win11-desktop', hostId: HOST_ID })
        .expect(404);
    });

    it('maps a duplicate name to 409', async () => {
      mocked.createBackupSource.mockRejectedValue(
        new service.DiscoveryError('conflict', 'name already exists'),
      );

      const res = await supertest(createServer())
        .post('/backup-sources')
        .send({ name: 'win11-desktop', hostId: HOST_ID })
        .expect(409);

      expect(res.body).toEqual({ message: 'name already exists' });
    });
  });

  describe('POST /backup-sources/:id/discovery-jobs', () => {
    it.each([
      ['a relative path', 'Users\\You'],
      ['a path with ..', 'C:\\Users\\..\\Windows'],
      ['an empty path', ''],
    ])('rejects %s', async (_label, rootPath) => {
      const res = await supertest(createServer())
        .post(`/backup-sources/${ID}/discovery-jobs`)
        .send({ rootPath })
        .expect(400);

      expect(res.body.message).toBe('Invalid request body');
      expect(mocked.createDiscoveryJob).not.toHaveBeenCalled();
    });

    it('rejects a non-uuid source id', async () => {
      await supertest(createServer())
        .post('/backup-sources/nope/discovery-jobs')
        .send({ rootPath: 'C:\\Users\\You' })
        .expect(400);
    });

    it('creates the job for a valid root', async () => {
      mocked.createDiscoveryJob.mockResolvedValue({ id: ID } as never);

      await supertest(createServer())
        .post(`/backup-sources/${ID}/discovery-jobs`)
        .send({ rootPath: 'C:\\Users\\You' })
        .expect(201);

      expect(mocked.createDiscoveryJob).toHaveBeenCalledWith(
        ID,
        'C:\\Users\\You',
      );
    });

    it('maps an unknown source to 404', async () => {
      mocked.createDiscoveryJob.mockRejectedValue(
        new service.DiscoveryError('not_found', 'backup source not found'),
      );

      await supertest(createServer())
        .post(`/backup-sources/${ID}/discovery-jobs`)
        .send({ rootPath: 'C:\\Users\\You' })
        .expect(404);
    });
  });

  describe('POST /discovery-jobs/:id/complete', () => {
    it('returns 409 with the blocking queue counts', async () => {
      const queueCounts = { queued: 2, in_progress: 1 };
      mocked.completeJob.mockRejectedValue(
        new service.DiscoveryError('conflict', 'job still has work', {
          queueCounts,
        }),
      );

      const res = await supertest(createServer())
        .post(`/discovery-jobs/${ID}/complete`)
        .expect(409);

      expect(res.body).toEqual({ message: 'job still has work', queueCounts });
    });
  });

  describe('POST /discovery-jobs/:id/queue-items', () => {
    it('rejects an empty paths array', async () => {
      await supertest(createServer())
        .post(`/discovery-jobs/${ID}/queue-items`)
        .send({ paths: [] })
        .expect(400);
    });

    it('defaults priority to 0 and flattens created flags', async () => {
      mocked.enqueuePaths.mockResolvedValue([
        { item: { id: ID, path: 'C:\\a' }, created: true },
        { item: { id: TOKEN, path: 'C:\\b' }, created: false },
      ] as never);

      const res = await supertest(createServer())
        .post(`/discovery-jobs/${ID}/queue-items`)
        .send({ paths: ['C:\\a', 'C:\\b'] })
        .expect(200);

      expect(mocked.enqueuePaths).toHaveBeenCalledWith(
        ID,
        ['C:\\a', 'C:\\b'],
        0,
      );
      expect(res.body.map((i: { created: boolean }) => i.created)).toEqual([
        true,
        false,
      ]);
    });
  });

  describe('POST /discovery-jobs/:id/queue-items/claim', () => {
    it('returns 204 when nothing is claimable', async () => {
      mocked.claimQueueItem.mockResolvedValue(undefined);

      await supertest(createServer())
        .post(`/discovery-jobs/${ID}/queue-items/claim`)
        .send({ workerId: 'w1' })
        .expect(204);

      expect(mocked.claimQueueItem).toHaveBeenCalledWith(ID, 'w1', 300);
    });

    it('returns the claimed item', async () => {
      mocked.claimQueueItem.mockResolvedValue({ id: TOKEN } as never);

      const res = await supertest(createServer())
        .post(`/discovery-jobs/${ID}/queue-items/claim`)
        .send({ workerId: 'w1', leaseSeconds: 60 })
        .expect(200);

      expect(res.body.id).toBe(TOKEN);
    });

    it('rejects a lease over an hour', async () => {
      await supertest(createServer())
        .post(`/discovery-jobs/${ID}/queue-items/claim`)
        .send({ workerId: 'w1', leaseSeconds: 3601 })
        .expect(400);
    });

    it('rejects a missing workerId', async () => {
      await supertest(createServer())
        .post(`/discovery-jobs/${ID}/queue-items/claim`)
        .send({})
        .expect(400);
    });
  });

  describe('POST /queue-items/:id/complete', () => {
    it('requires a claim token', async () => {
      await supertest(createServer())
        .post(`/queue-items/${ID}/complete`)
        .send({})
        .expect(400);
    });

    it('passes discovered paths through and nests the children', async () => {
      mocked.completeItem.mockResolvedValue({
        item: { id: ID },
        children: [{ item: { id: TOKEN }, created: true }],
      } as never);

      const res = await supertest(createServer())
        .post(`/queue-items/${ID}/complete`)
        .send({ claimToken: TOKEN, discoveredPaths: ['C:\\a\\b'] })
        .expect(200);

      expect(mocked.completeItem).toHaveBeenCalledWith(ID, TOKEN, ['C:\\a\\b']);
      expect(res.body.children).toEqual([{ id: TOKEN, created: true }]);
    });

    it('returns 409 when the claim is lost', async () => {
      mocked.completeItem.mockRejectedValue(
        new service.DiscoveryError('conflict', 'claim is no longer valid'),
      );

      await supertest(createServer())
        .post(`/queue-items/${ID}/complete`)
        .send({ claimToken: TOKEN })
        .expect(409);
    });
  });

  describe('POST /queue-items/:id/fail', () => {
    it('defaults retryable to true', async () => {
      mocked.failItem.mockResolvedValue({ id: ID } as never);

      await supertest(createServer())
        .post(`/queue-items/${ID}/fail`)
        .send({ claimToken: TOKEN, error: 'EBUSY' })
        .expect(200);

      expect(mocked.failItem).toHaveBeenCalledWith(ID, TOKEN, 'EBUSY', true);
    });

    it('requires an error message', async () => {
      await supertest(createServer())
        .post(`/queue-items/${ID}/fail`)
        .send({ claimToken: TOKEN })
        .expect(400);
    });
  });

  describe('POST /queue-items/:id/retry', () => {
    it('maps a non-failed item to 409', async () => {
      mocked.retryItem.mockRejectedValue(
        new service.DiscoveryError(
          'conflict',
          'only failed items can be retried',
        ),
      );

      await supertest(createServer())
        .post(`/queue-items/${ID}/retry`)
        .expect(409);
    });
  });

  describe('GET /backup-sources/:id/discovery-jobs', () => {
    it('returns the jobs', async () => {
      mocked.listSourceJobs.mockResolvedValue([{ id: TOKEN }] as never);

      const res = await supertest(createServer())
        .get(`/backup-sources/${ID}/discovery-jobs`)
        .expect(200);

      expect(res.body).toEqual([{ id: TOKEN }]);
      expect(mocked.listSourceJobs).toHaveBeenCalledWith(ID);
    });

    it('maps an unknown source to 404', async () => {
      mocked.listSourceJobs.mockRejectedValue(
        new service.DiscoveryError('not_found', 'backup source not found'),
      );

      await supertest(createServer())
        .get(`/backup-sources/${ID}/discovery-jobs`)
        .expect(404);
    });
  });

  describe('GET /backup-sources/:id/queue-items', () => {
    it('rejects an unknown status filter', async () => {
      await supertest(createServer())
        .get(`/backup-sources/${ID}/queue-items`)
        .query({ status: 'bogus' })
        .expect(400);
    });

    it('passes filters to the service', async () => {
      mocked.listSourceQueueItems.mockResolvedValue([]);

      await supertest(createServer())
        .get(`/backup-sources/${ID}/queue-items`)
        .query({ status: 'failed' })
        .expect(200);

      expect(mocked.listSourceQueueItems).toHaveBeenCalledWith(ID, {
        status: 'failed',
      });
    });
  });

  it('logs and returns a generic message on an unexpected error', async () => {
    const err = new Error('connection reset');
    mocked.listBackupSources.mockRejectedValue(err);

    const res = await supertest(createServer())
      .get('/backup-sources')
      .expect(500);

    expect(res.body).toEqual({ message: 'internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'GET /backup-sources failed:',
      err,
    );
  });
});
