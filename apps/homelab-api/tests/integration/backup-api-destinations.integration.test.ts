import { recordBackupDestinationValidation } from '@abbottland/homelab-db';
import { db } from '../../src/db';
import {
  WORKER,
  auditCount,
  makeDestination,
  makeHost,
  makeInventoryItem,
  makeSource,
  api,
  apiDestinationIds,
  create,
  useBackupApiCleanup,
} from './fixtures/backup';

useBackupApiCleanup();

describe('destinations', () => {
  let hostId: string;
  beforeAll(async () => {
    hostId = await makeHost();
  });

  const body = () => ({
    name: `api-dest-${Math.random().toString(36).slice(2)}`,
    hostId,
    settings: { exportPath: '/volume1/Test' },
  });

  it('creates one, audits once, and a duplicate name is 409 with no event', async () => {
    const payload = body();
    const res = await api()
      .post('/backup-destinations')
      .send(payload)
      .expect(201);
    apiDestinationIds.push(res.body.id);

    expect(res.body).toMatchObject({
      name: payload.name,
      connectionType: 'nfs',
      enabled: true,
      health: 'unknown',
      rootDir: null,
      workerStale: true,
      hostId,
      host: { id: hostId, ipAddress: '192.0.2.10' },
    });
    expect(
      await auditCount('backup_destination.created', {
        destinationId: res.body.id,
      }),
    ).toBe(1);

    await api().post('/backup-destinations').send(payload).expect(409);
    expect(
      await auditCount('backup_destination.created', {
        destinationId: res.body.id,
      }),
    ).toBe(1);
  });

  it('answers 404 for a host that does not exist', async () => {
    await api()
      .post('/backup-destinations')
      .send({ ...body(), hostId: crypto.randomUUID() })
      .expect(404);
  });

  it('refuses a non-human actor without writing', async () => {
    const payload = body();
    await api()
      .post('/backup-destinations')
      .set('x-actor-type', 'openclaw')
      .send(payload)
      .expect(403);

    const list = await api().get('/backup-destinations').expect(200);
    expect(
      list.body.some((d: { name: string }) => d.name === payload.name),
    ).toBe(false);
  });

  it('validate only records the request: 202, no audit event', async () => {
    const destination = await makeDestination();

    const res = await api()
      .post(`/backup-destinations/${destination.id}/validate`)
      .expect(202);

    expect(res.body.validationRequestedAt).not.toBeNull();
    expect(res.body.health).toBe('unknown');
    expect(res.body.lastValidation).toBeNull();
    await api()
      .post(`/backup-destinations/${crypto.randomUUID()}/validate`)
      .expect(404);
  });

  it('reports a worker that polled recently as not stale', async () => {
    const destination = await makeDestination();
    await recordBackupDestinationValidation(db, destination.id, {
      workerId: WORKER.id,
      validation: { ok: true },
    });

    const res = await api()
      .get(`/backup-destinations/${destination.id}`)
      .expect(200);
    expect(res.body).toMatchObject({ workerStale: false, health: 'ok' });
  });

  it('audits enable and disable only when they change something', async () => {
    const destination = await makeDestination();
    const events = (type: string) =>
      auditCount(type, { destinationId: destination.id });

    await api()
      .post(`/backup-destinations/${destination.id}/disable`)
      .expect(200);
    await api()
      .post(`/backup-destinations/${destination.id}/disable`)
      .expect(200);
    expect(await events('backup_destination.disabled')).toBe(1);

    await api()
      .post(`/backup-destinations/${destination.id}/enable`)
      .expect(200);
    await api()
      .post(`/backup-destinations/${destination.id}/enable`)
      .expect(200);
    expect(await events('backup_destination.enabled')).toBe(1);
  });

  it('locks identity fields once a job exists but still allows a rename', async () => {
    const destination = await makeDestination();
    const sourceId = await makeSource();
    await makeInventoryItem(sourceId, 'C:\\data\\a.txt');
    await create(sourceId, { destinationId: destination.id }).expect(201);
    const updated = () =>
      auditCount('backup_destination.updated', {
        destinationId: destination.id,
      });

    await api()
      .patch(`/backup-destinations/${destination.id}`)
      .send({ settings: { exportPath: '/volume1/Other' } })
      .expect(409);
    await api()
      .patch(`/backup-destinations/${destination.id}`)
      .send({ hostId: await makeHost() })
      .expect(409);
    await api()
      .patch(`/backup-destinations/${destination.id}`)
      .send({ rootDir: 'sub' })
      .expect(409);
    expect(await updated()).toBe(0);

    const renamed = `${destination.name}-renamed`;
    const res = await api()
      .patch(`/backup-destinations/${destination.id}`)
      .send({ name: renamed })
      .expect(200);
    expect(res.body.name).toBe(renamed);
    expect(await updated()).toBe(1);
  });
});
