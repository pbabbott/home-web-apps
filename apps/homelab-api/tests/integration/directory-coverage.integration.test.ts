import {
  listInventoryUnder,
  listJobQueueStatusesAt,
} from '@abbottland/homelab-db';
import { db } from '../../src/db';
import { getRequest } from '../jest.integration.setup';
import type { ClaimedItem } from './fixtures/selective-agent';

// Runs against the real local dev Postgres; sources cascade to everything they own.
const createdSourceIds: string[] = [];

afterEach(async () => {
  await db.$client.query('delete from audit_events where source_id = any($1)', [
    createdSourceIds,
  ]);
  await db.$client.query('delete from sources where id = any($1)', [
    createdSourceIds,
  ]);
  createdSourceIds.length = 0;
});

const DOWNLOADS = 'C:\\Users\\Me\\Downloads';
const HUMAN = { 'X-Actor-Id': 'brandon' };

describe('queries behind the directory listing', () => {
  it('finds inventory beneath a directory and the job’s queue items at exact paths', async () => {
    const source = await getRequest()
      .post('/sources')
      .send({ name: `exodus-cov-${Math.random().toString(36).slice(2)}` })
      .expect(201);
    const sourceId = source.body.id as string;
    createdSourceIds.push(sourceId);

    const job = (
      await getRequest()
        .post(`/sources/${sourceId}/discovery-jobs`)
        .send({ rootPath: DOWNLOADS })
        .expect(201)
    ).body as { id: string };
    const item = (
      await getRequest()
        .post(`/discovery-jobs/${job.id}/queue-items/claim`)
        .send({ workerId: 'w1', leaseSeconds: 300 })
        .expect(200)
    ).body.item as ClaimedItem;
    await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send({
        claimToken: item.claimToken,
        skipped: [{ path: `${DOWNLOADS}\\a.pdf`, reason: 'x' }],
        discoveredPaths: [{ path: `${DOWNLOADS}\\Sub`, reason: 'look inside' }],
      })
      .expect(200);
    await getRequest()
      .post(`/queue-items/${item.id}/promote`)
      .set(HUMAN)
      .send({ path: `${DOWNLOADS}\\a.pdf`, kind: 'file' })
      .expect(201);

    const under = await listInventoryUnder(
      db,
      sourceId,
      'c:\\users\\me\\downloads',
    );
    expect(under).toEqual([
      {
        normalizedRootPath: 'c:\\users\\me\\downloads\\a.pdf',
        decision: 'approved',
        recommendation: expect.any(String),
      },
    ]);
    expect(
      await listInventoryUnder(db, sourceId, 'c:\\users\\me\\documents'),
    ).toEqual([]);

    const statuses = await listJobQueueStatusesAt(db, job.id, [
      'c:\\users\\me\\downloads\\sub',
      'c:\\users\\me\\downloads\\nope',
    ]);
    expect([...statuses.entries()]).toEqual([
      ['c:\\users\\me\\downloads\\sub', 'queued'],
    ]);
    expect((await listJobQueueStatusesAt(db, job.id, [])).size).toBe(0);
  });
});
