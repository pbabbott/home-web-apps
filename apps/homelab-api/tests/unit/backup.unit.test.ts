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
      settings: { server: '192.168.4.124', exportPath: '/volume1/Dump' },
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
      ['a server with a slash', { server: 'nas/x' }],
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
});
