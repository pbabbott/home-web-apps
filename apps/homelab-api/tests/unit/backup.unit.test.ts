import supertest from 'supertest';
import { createServer } from '../../src/server';
import * as service from '../../src/services/backup';

jest.mock('../../src/services/backup', () => {
  const actual = jest.requireActual('../../src/services/backup');

  return {
    BackupError: actual.BackupError,
    createDestination: jest.fn(),
    listDestinations: jest.fn(),
    getDestination: jest.fn(),
    updateDestination: jest.fn(),
    setDestinationEnabled: jest.fn(),
    requestValidation: jest.fn(),
    planJob: jest.fn(),
    createJob: jest.fn(),
    listJobs: jest.fn(),
    getJob: jest.fn(),
    cancelJob: jest.fn(),
    failJob: jest.fn(),
    retryFailedItems: jest.fn(),
    rerunUnresolved: jest.fn(),
    listJobItems: jest.fn(),
    getJobItem: jest.fn(),
    listItemEntries: jest.fn(),
    retryItem: jest.fn(),
    getCoverage: jest.fn(),
  };
});

const mocked = jest.mocked(service);
const ID = '123e4567-e89b-12d3-a456-426614174000';

describe('backup routes', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  describe('backup destinations', () => {
    const body = {
      name: 'Dump',
      hostId: ID,
      settings: { exportPath: '/volume1/Dump' },
    };

    it('creates a destination, defaulting type and enabled', async () => {
      mocked.createDestination.mockResolvedValue({ id: ID } as never);

      await supertest(createServer())
        .post('/backup-destinations')
        .send(body)
        .expect(201);

      expect(mocked.createDestination).toHaveBeenCalledWith(
        { ...body, connectionType: 'nfs', enabled: true },
        { type: 'human', id: null },
      );
    });

    it.each([
      ['a relative export path', { exportPath: 'volume1/Dump' }],
      ['a .. segment', { exportPath: '/volume1/../etc' }],
    ])('rejects %s', async (_label, settings) => {
      await supertest(createServer())
        .post('/backup-destinations')
        .send({ ...body, settings: { ...body.settings, ...settings } })
        .expect(400);
    });

    it('normalizes a blank rootDir to null and rejects an escaping one', async () => {
      mocked.createDestination.mockResolvedValue({ id: ID } as never);

      await supertest(createServer())
        .post('/backup-destinations')
        .send({ ...body, rootDir: '  ' })
        .expect(201);
      expect(mocked.createDestination.mock.calls[0][0].rootDir).toBeNull();

      await supertest(createServer())
        .post('/backup-destinations')
        .send({ ...body, rootDir: '../x' })
        .expect(400);
      await supertest(createServer())
        .post('/backup-destinations')
        .send({ ...body, rootDir: '/abs' })
        .expect(400);
    });

    it('refuses a non-human actor', async () => {
      await supertest(createServer())
        .post('/backup-destinations')
        .set('x-actor-type', 'openclaw')
        .send(body)
        .expect(403);

      expect(mocked.createDestination).not.toHaveBeenCalled();
    });

    it('maps a duplicate name to 409', async () => {
      mocked.createDestination.mockRejectedValue(
        new service.BackupError('conflict', 'already exists'),
      );

      const res = await supertest(createServer())
        .post('/backup-destinations')
        .send(body)
        .expect(409);

      expect(res.body).toEqual({ message: 'already exists' });
    });

    it('lists and fetches destinations; unknown id is 404', async () => {
      mocked.listDestinations.mockResolvedValue([]);
      await supertest(createServer()).get('/backup-destinations').expect(200);

      mocked.getDestination.mockRejectedValue(
        new service.BackupError('not_found', 'backup destination not found'),
      );
      await supertest(createServer())
        .get(`/backup-destinations/${ID}`)
        .expect(404);
      await supertest(createServer())
        .get('/backup-destinations/nope')
        .expect(400);
    });

    it('rejects an empty patch and passes a rename', async () => {
      await supertest(createServer())
        .patch(`/backup-destinations/${ID}`)
        .send({})
        .expect(400);

      mocked.updateDestination.mockResolvedValue({ id: ID } as never);
      await supertest(createServer())
        .patch(`/backup-destinations/${ID}`)
        .send({ name: 'Dump 2' })
        .expect(200);
      expect(mocked.updateDestination).toHaveBeenCalledWith(
        ID,
        { name: 'Dump 2' },
        { type: 'human', id: null },
      );
    });

    it('answers 202 for validate', async () => {
      mocked.requestValidation.mockResolvedValue({ id: ID } as never);

      await supertest(createServer())
        .post(`/backup-destinations/${ID}/validate`)
        .expect(202);
      expect(mocked.requestValidation).toHaveBeenCalledWith(ID);
    });

    it('enables and disables', async () => {
      mocked.setDestinationEnabled.mockResolvedValue({ id: ID } as never);

      await supertest(createServer())
        .post(`/backup-destinations/${ID}/enable`)
        .expect(200);
      await supertest(createServer())
        .post(`/backup-destinations/${ID}/disable`)
        .expect(200);

      expect(mocked.setDestinationEnabled.mock.calls.map((c) => c[1])).toEqual([
        true,
        false,
      ]);
    });
  });

  describe('backup job planning', () => {
    const DEST = '223e4567-e89b-12d3-a456-426614174000';

    it('plans with skipAlreadyCovered defaulting to true', async () => {
      mocked.planJob.mockResolvedValue({ items: [] } as never);

      await supertest(createServer())
        .post(`/sources/${ID}/backup-jobs/plan`)
        .send({ destinationId: DEST })
        .expect(200);

      expect(mocked.planJob).toHaveBeenCalledWith(ID, {
        destinationId: DEST,
        skipAlreadyCovered: true,
      });
    });

    it.each([
      ['no destination', {}],
      ['a non-uuid item id', { destinationId: DEST, inventoryItemIds: ['x'] }],
      ['a relative path prefix', { destinationId: DEST, pathPrefix: 'a\\b' }],
      ['an unknown kind', { destinationId: DEST, kinds: ['symlink'] }],
    ])('rejects %s', async (_label, body) => {
      await supertest(createServer())
        .post(`/sources/${ID}/backup-jobs/plan`)
        .send(body)
        .expect(400);
    });

    it('maps conflicts to 409 with their details', async () => {
      mocked.planJob.mockRejectedValue(
        new service.BackupError('conflict', 'nothing to back up', {
          notEligible: [],
        }),
      );

      const res = await supertest(createServer())
        .post(`/sources/${ID}/backup-jobs/plan`)
        .send({ destinationId: DEST })
        .expect(409);

      expect(res.body).toEqual({
        message: 'nothing to back up',
        notEligible: [],
      });
    });

    it('creates a job as the human actor', async () => {
      mocked.createJob.mockResolvedValue({ id: ID } as never);

      await supertest(createServer())
        .post(`/sources/${ID}/backup-jobs`)
        .set('x-actor-id', 'brandon')
        .send({ destinationId: DEST, kinds: ['file'] })
        .expect(201);

      expect(mocked.createJob).toHaveBeenCalledWith(
        ID,
        { destinationId: DEST, kinds: ['file'], skipAlreadyCovered: true },
        { type: 'human', id: 'brandon' },
      );
    });

    it('refuses a non-human actor for plan and create', async () => {
      for (const path of ['/backup-jobs/plan', '/backup-jobs']) {
        await supertest(createServer())
          .post(`/sources/${ID}${path}`)
          .set('x-actor-type', 'system')
          .send({ destinationId: DEST })
          .expect(403);
      }
      expect(mocked.planJob).not.toHaveBeenCalled();
      expect(mocked.createJob).not.toHaveBeenCalled();
    });
  });

  describe('backup jobs, items and entries', () => {
    const human = { type: 'human', id: null };

    it('lists jobs with filters and a default limit', async () => {
      mocked.listJobs.mockResolvedValue([]);

      await supertest(createServer())
        .get(`/backup-jobs?sourceId=${ID}&status=running`)
        .expect(200);
      expect(mocked.listJobs).toHaveBeenCalledWith({
        sourceId: ID,
        status: 'running',
        limit: 50,
      });

      await supertest(createServer())
        .get('/backup-jobs?status=bogus')
        .expect(400);
    });

    it('fetches a job and maps an unknown one to 404', async () => {
      mocked.getJob.mockRejectedValue(
        new service.BackupError('not_found', 'backup job not found'),
      );

      await supertest(createServer()).get(`/backup-jobs/${ID}`).expect(404);
      await supertest(createServer()).get('/backup-jobs/nope').expect(400);
    });

    it('cancels, and maps a finished job to 409', async () => {
      mocked.cancelJob.mockResolvedValue({ id: ID } as never);
      await supertest(createServer())
        .post(`/backup-jobs/${ID}/cancel`)
        .expect(200);
      expect(mocked.cancelJob).toHaveBeenCalledWith(ID, human);

      mocked.cancelJob.mockRejectedValue(
        new service.BackupError('conflict', 'job is already completed'),
      );
      await supertest(createServer())
        .post(`/backup-jobs/${ID}/cancel`)
        .expect(409);
    });

    it('requires a reason to fail a job', async () => {
      await supertest(createServer())
        .post(`/backup-jobs/${ID}/fail`)
        .send({})
        .expect(400);

      mocked.failJob.mockResolvedValue({ id: ID } as never);
      await supertest(createServer())
        .post(`/backup-jobs/${ID}/fail`)
        .send({ error: 'source is being reinstalled' })
        .expect(200);
      expect(mocked.failJob).toHaveBeenCalledWith(
        ID,
        'source is being reinstalled',
        human,
      );
    });

    it('retries failed items and reruns unresolved ones', async () => {
      mocked.retryFailedItems.mockResolvedValue({ retried: 0, items: [] });
      await supertest(createServer())
        .post(`/backup-jobs/${ID}/retry-failed`)
        .expect(200);

      mocked.rerunUnresolved.mockResolvedValue({ id: ID } as never);
      await supertest(createServer())
        .post(`/backup-jobs/${ID}/rerun-unresolved`)
        .expect(201);
      expect(mocked.rerunUnresolved).toHaveBeenCalledWith(ID, human);
    });

    it('refuses a non-human actor on every job and item action', async () => {
      for (const path of [
        `/backup-jobs/${ID}/cancel`,
        `/backup-jobs/${ID}/retry-failed`,
        `/backup-jobs/${ID}/rerun-unresolved`,
        `/backup-job-items/${ID}/retry`,
      ]) {
        await supertest(createServer())
          .post(path)
          .set('x-actor-type', 'openclaw')
          .expect(403);
      }
    });

    it('pages items and entries with defaults', async () => {
      mocked.listJobItems.mockResolvedValue({ items: [], next: null });
      await supertest(createServer())
        .get(`/backup-jobs/${ID}/items?status=failed`)
        .expect(200);
      expect(mocked.listJobItems).toHaveBeenCalledWith(ID, {
        status: 'failed',
        limit: 100,
      });

      mocked.listItemEntries.mockResolvedValue({ entries: [], next: null });
      await supertest(createServer())
        .get(`/backup-job-items/${ID}/entries?issueKind=kept_both&after=7`)
        .expect(200);
      expect(mocked.listItemEntries).toHaveBeenCalledWith(ID, {
        issueKind: 'kept_both',
        after: 7,
        limit: 200,
      });

      await supertest(createServer())
        .get(`/backup-job-items/${ID}/entries?limit=5000`)
        .expect(400);
    });

    it('fetches and retries an item', async () => {
      mocked.getJobItem.mockResolvedValue({ id: ID } as never);
      await supertest(createServer())
        .get(`/backup-job-items/${ID}`)
        .expect(200);

      mocked.retryItem.mockRejectedValue(
        new service.BackupError('conflict', 'job is not active'),
      );
      await supertest(createServer())
        .post(`/backup-job-items/${ID}/retry`)
        .expect(409);
    });
  });

  describe('backup coverage', () => {
    const DEST = '223e4567-e89b-12d3-a456-426614174000';
    const report = {
      source: { id: ID, name: 'Alpha Centauri' },
      destination: { id: DEST, name: 'Dump' },
      generatedAt: new Date('2026-10-28T12:00:00Z'),
      allAccounted: false,
      items: [],
    };

    it('requires a destination and a known bucket', async () => {
      await supertest(createServer())
        .get(`/sources/${ID}/backup-coverage`)
        .expect(400);
      await supertest(createServer())
        .get(
          `/sources/${ID}/backup-coverage?destinationId=${DEST}&bucket=bogus`,
        )
        .expect(400);
    });

    it('answers the report as JSON, passing the bucket', async () => {
      mocked.getCoverage.mockResolvedValue(report as never);

      const res = await supertest(createServer())
        .get(
          `/sources/${ID}/backup-coverage?destinationId=${DEST}&bucket=failed`,
        )
        .expect(200);

      expect(res.headers['content-disposition']).toBeUndefined();
      expect(mocked.getCoverage).toHaveBeenCalledWith(
        ID,
        { destinationId: DEST, bucket: 'failed' },
        false,
      );
    });

    it('downloads the full report as a named file with format=json', async () => {
      mocked.getCoverage.mockResolvedValue(report as never);

      const res = await supertest(createServer())
        .get(`/sources/${ID}/backup-coverage?destinationId=${DEST}&format=json`)
        .expect(200);

      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="backup-coverage-alpha-centauri-dump-2026-10-28.json"',
      );
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(JSON.parse(res.text).allAccounted).toBe(false);
      expect(mocked.getCoverage.mock.calls[0][2]).toBe(true);
    });

    it('maps an unknown source to 404', async () => {
      mocked.getCoverage.mockRejectedValue(
        new service.BackupError('not_found', 'source not found'),
      );

      await supertest(createServer())
        .get(`/sources/${ID}/backup-coverage?destinationId=${DEST}`)
        .expect(404);
    });
  });
});
