import { db } from '../../src/db';
import { getRequest } from '../jest.integration.setup';
import { type ClaimedItem } from './fixtures/selective-agent';
import {
  decide,
  inventoryItemEvents,
  listInventoryItems,
  propose,
  proposal,
  startAndClaim,
  createRule,
  createSource,
  useInventoryCleanup,
} from './fixtures/inventory';

useInventoryCleanup();

describe('promoting a skipped path', () => {
  const DOWNLOADS = 'C:\\Users\\Me\\Downloads';
  const KEEPER = `${DOWNLOADS}\\tax-return.pdf`;

  const queueOf = async (jobId: string) =>
    (await getRequest().get(`/discovery-jobs/${jobId}/queue-items`).expect(200))
      .body as Record<string, any>[];

  const promote = (
    item: ClaimedItem,
    body: object,
    headers: Record<string, string> = { 'X-Actor-Id': 'brandon' },
  ) =>
    getRequest()
      .post(`/queue-items/${item.id}/promote`)
      .set(headers)
      .send(body);

  /** Claims Downloads and completes it with the keeper wrongly skipped. */
  const skipKeeper = async (sourceId: string) => {
    const { job, item } = await startAndClaim(sourceId, DOWNLOADS);
    await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send({
        claimToken: item.claimToken,
        skipped: [{ path: KEEPER, reason: 'looked like a download' }],
      })
      .expect(200);

    return { job, item };
  };

  it('creates an approved inventory item and one promoted audit event', async () => {
    const sourceId = await createSource();
    const { item } = await skipKeeper(sourceId);

    const res = await promote(item, {
      path: KEEPER,
      kind: 'file',
      note: 'my taxes',
      skipReason: 'looked like a download',
    }).expect(201);

    expect(res.body).toMatchObject({
      rootPath: KEEPER,
      kind: 'file',
      displayName: 'tax-return.pdf',
      recommendation: 'back_up',
      decision: 'approved',
      decisionNote: 'my taxes',
      decidedBy: 'brandon',
    });
    expect(await listInventoryItems(sourceId)).toHaveLength(1);

    const events = await inventoryItemEvents(res.body.id);
    expect(events.map((e) => e.eventType)).toEqual(['inventory_item.promoted']);
    expect(events[0]).toMatchObject({
      actorType: 'human',
      actorId: 'brandon',
      details: { path: KEEPER, skipReason: 'looked like a download' },
    });
  });

  it('only a human may promote', async () => {
    const sourceId = await createSource();
    const { item } = await skipKeeper(sourceId);

    await promote(
      item,
      { path: KEEPER, kind: 'file' },
      { 'X-Actor-Type': 'openclaw', 'X-Actor-Id': 'agent' },
    ).expect(409);

    expect(await listInventoryItems(sourceId)).toHaveLength(0);
  });

  it('refuses a path that already has an inventory item, changing nothing', async () => {
    const sourceId = await createSource();
    const { item } = await skipKeeper(sourceId);
    const first = await promote(item, { path: KEEPER, kind: 'file' }).expect(
      201,
    );

    const again = await promote(item, {
      path: KEEPER.toLowerCase(),
      kind: 'file',
    }).expect(409);

    expect(again.body).toMatchObject({
      inventoryItemId: first.body.id,
    });
    expect(await listInventoryItems(sourceId)).toHaveLength(1);
  });

  it('refuses a path under an exclusion rule', async () => {
    const sourceId = await createSource();
    const { item } = await skipKeeper(sourceId);
    await createRule({
      sourceId,
      path: DOWNLOADS,
      scope: 'exclude_subtree',
    });

    const res = await promote(item, { path: KEEPER, kind: 'file' }).expect(409);

    expect(res.body.blocked).toHaveLength(1);
    expect(await listInventoryItems(sourceId)).toHaveLength(0);
  });

  it('refuses a path outside, or equal to, the queue item’s directory', async () => {
    const sourceId = await createSource();
    const { item } = await skipKeeper(sourceId);

    await promote(item, {
      path: 'C:\\Users\\Me\\Documents\\a.pdf',
      kind: 'file',
    }).expect(409);
    await promote(item, { path: DOWNLOADS, kind: 'directory' }).expect(409);

    expect(await listInventoryItems(sourceId)).toHaveLength(0);
  });

  it('leaves the agent’s skip record untouched', async () => {
    const sourceId = await createSource();
    const { job, item } = await skipKeeper(sourceId);

    await promote(item, { path: KEEPER, kind: 'file' }).expect(201);

    expect((await queueOf(job.id))[0].result.skipped).toEqual([
      { path: KEEPER, reason: 'looked like a download' },
    ]);
  });
});

describe('inventorying a whole directory', () => {
  const USERS = 'C:\\Users';
  const DRIVE = `${USERS}\\me\\Google Drive`;
  const FINANCE = `${DRIVE}\\Finance`;
  const PHOTOS = `${DRIVE}\\Photos`;
  const OTHER = `${USERS}\\me\\Music`;

  const enqueue = (jobId: string, paths: string[], priority = 0) =>
    getRequest()
      .post(`/discovery-jobs/${jobId}/queue-items`)
      .send({ paths, priority })
      .expect(200);

  const claim = async (jobId: string) =>
    (
      await getRequest()
        .post(`/discovery-jobs/${jobId}/queue-items/claim`)
        .send({ workerId: 'w1', leaseSeconds: 300 })
        .expect(200)
    ).body as { item: ClaimedItem | null };

  const statusesOf = async (jobId: string) =>
    Object.fromEntries(
      (
        (
          await getRequest()
            .get(`/discovery-jobs/${jobId}/queue-items`)
            .expect(200)
        ).body as { path: string; status: string }[]
      ).map((q) => [q.path, q.status]),
    );

  const inventoryDirectory = (
    item: { id: string },
    body: object = {},
    headers: Record<string, string> = { 'X-Actor-Id': 'brandon' },
  ) =>
    getRequest()
      .post(`/queue-items/${item.id}/inventory-directory`)
      .set(headers)
      .send(body);

  const auditTypes = async (sourceId: string) =>
    (
      (await getRequest().get('/audit-events').query({ sourceId }).expect(200))
        .body as { eventType: string }[]
    ).map((e) => e.eventType);

  /** A job rooted at C:\Users that has claimed the drive and queued its subfolders. */
  const driveWithChildren = async (sourceId: string) => {
    const { job } = await startAndClaim(sourceId, USERS);
    await enqueue(job.id, [DRIVE], 10);
    const { item: drive } = await claim(job.id);
    await enqueue(job.id, [FINANCE, PHOTOS, OTHER]);

    return { job, drive: drive as ClaimedItem };
  };

  it('creates an approved directory item and skips the queued subfolders', async () => {
    const sourceId = await createSource();
    const { job, drive } = await driveWithChildren(sourceId);

    const res = await inventoryDirectory(drive, { note: 'all of it' }).expect(
      200,
    );

    expect(res.body).toMatchObject({
      created: true,
      skippedQueueItems: 2,
      inventoryItem: {
        kind: 'directory',
        rootPath: DRIVE,
        displayName: 'Google Drive',
        recommendation: 'back_up',
        decision: 'approved',
        decisionNote: 'all of it',
        decidedBy: 'brandon',
      },
    });
    expect(await statusesOf(job.id)).toMatchObject({
      [DRIVE]: 'in_progress',
      [FINANCE]: 'skipped',
      [PHOTOS]: 'skipped',
      [OTHER]: 'queued',
    });
    expect(await auditTypes(sourceId)).toEqual(
      expect.arrayContaining([
        'inventory_item.promoted',
        'queue_items.inventoried',
      ]),
    );

    const queue = (
      await getRequest()
        .get(`/discovery-jobs/${job.id}/queue-items`)
        .expect(200)
    ).body as { path: string; lastError: string | null }[];
    expect(queue.find((q) => q.path === FINANCE)?.lastError).toBe(
      `skipped: covered by approved inventory item ${DRIVE}`,
    );
  });

  it('names the nearest approved directory when several cover an item', async () => {
    const sourceId = await createSource();
    const { job, drive } = await driveWithChildren(sourceId);
    const nested = `${DRIVE}\\Finance\\Taxes`;
    await enqueue(job.id, [nested]);
    await db.$client.query(
      "update discovery_queue_items set status = 'queued', last_error = null, completed_at = null where job_id = $1 and path = $2",
      [job.id, nested],
    );
    const financeItem = (
      (
        await getRequest()
          .get(`/discovery-jobs/${job.id}/queue-items`)
          .expect(200)
      ).body as { id: string; path: string }[]
    ).find((q) => q.path === FINANCE) as { id: string };
    await inventoryDirectory(financeItem).expect(200);
    await db.$client.query(
      "update discovery_queue_items set status = 'queued', last_error = null, completed_at = null where job_id = $1 and path = $2",
      [job.id, nested],
    );

    await inventoryDirectory(drive).expect(200);

    const row = (
      (
        await getRequest()
          .get(`/discovery-jobs/${job.id}/queue-items`)
          .expect(200)
      ).body as { path: string; lastError: string | null }[]
    ).find((q) => q.path === nested);
    expect(row?.lastError).toBe(
      `skipped: covered by approved inventory item ${FINANCE}`,
    );
  });

  it('approves the agent’s proposal instead of replacing it', async () => {
    const sourceId = await createSource();
    const { job, drive } = await driveWithChildren(sourceId);
    const proposed = await propose(drive, [
      proposal(DRIVE, {
        recommendation: 'needs_review',
        confidence: 'medium',
        reason: 'synced folder',
      }),
    ]).expect(200);

    const res = await inventoryDirectory(drive).expect(200);

    expect(res.body).toMatchObject({
      created: false,
      skippedQueueItems: 2,
      inventoryItem: {
        id: proposed.body[0].id,
        decision: 'approved',
        recommendation: 'needs_review',
        recommendationReason: 'synced folder',
      },
    });
    expect(await listInventoryItems(sourceId)).toHaveLength(1);
    expect((await statusesOf(job.id))[FINANCE]).toBe('skipped');
  });

  it('is idempotent: repeating adds no decision event', async () => {
    const sourceId = await createSource();
    const { drive } = await driveWithChildren(sourceId);
    await propose(drive, [proposal(DRIVE)]).expect(200);

    const first = await inventoryDirectory(drive, { note: 'x' }).expect(200);
    const events = await inventoryItemEvents(first.body.inventoryItem.id);
    const again = await inventoryDirectory(drive, { note: 'x' }).expect(200);

    expect(again.body.skippedQueueItems).toBe(0);
    expect(await inventoryItemEvents(again.body.inventoryItem.id)).toEqual(
      events,
    );
  });

  it('only a human may do it', async () => {
    const sourceId = await createSource();
    const { job, drive } = await driveWithChildren(sourceId);

    await inventoryDirectory(
      drive,
      {},
      { 'X-Actor-Type': 'openclaw', 'X-Actor-Id': 'agent' },
    ).expect(409);

    expect(await listInventoryItems(sourceId)).toHaveLength(0);
    expect((await statusesOf(job.id))[FINANCE]).toBe('queued');
  });

  it('refuses a directory under an exclusion rule', async () => {
    const sourceId = await createSource();
    const { job, drive } = await driveWithChildren(sourceId);
    await createRule({ sourceId, path: DRIVE, scope: 'selective_only' });

    await inventoryDirectory(drive).expect(409);

    expect(await listInventoryItems(sourceId)).toHaveLength(0);
    expect((await statusesOf(job.id))[FINANCE]).toBe('queued');
  });

  it('skips work queued under the directory afterwards, at enqueue and at claim', async () => {
    const sourceId = await createSource();
    const { job, drive } = await driveWithChildren(sourceId);
    await inventoryDirectory(drive).expect(200);

    const late = `${DRIVE}\\Late`;
    const res = await enqueue(job.id, [late]);

    expect(res.body[0].status).toBe('skipped');
    // Only the unrelated directory is left to hand out.
    expect((await claim(job.id)).item?.path).toBe(OTHER);
    expect((await claim(job.id)).item).toBeNull();
  });

  it('approving an agent-proposed directory in review skips its queued subfolders too', async () => {
    const sourceId = await createSource();
    const { job, drive } = await driveWithChildren(sourceId);
    const proposed = await propose(drive, [proposal(DRIVE)]).expect(200);

    await decide(proposed.body[0].id, { decision: 'approved' }).expect(200);

    expect(await statusesOf(job.id)).toMatchObject({
      [FINANCE]: 'skipped',
      [PHOTOS]: 'skipped',
      [OTHER]: 'queued',
    });
  });

  it('touches only the approved directory’s subtree, not other approved directories', async () => {
    const sourceId = await createSource();
    const { job, drive } = await driveWithChildren(sourceId);
    const dropbox = `${USERS}\\me\\Dropbox`;
    const dropboxChild = `${dropbox}\\Audio`;
    await enqueue(job.id, [dropbox]);
    const queue = (
      await getRequest()
        .get(`/discovery-jobs/${job.id}/queue-items`)
        .expect(200)
    ).body as { id: string; path: string }[];
    await inventoryDirectory(
      queue.find((q) => q.path === dropbox) as object & {
        id: string;
      },
    ).expect(200);
    // Enqueue enforces the Dropbox approval, so put its child back to queued
    // directly: it stands for work queued before Dropbox was approved.
    await enqueue(job.id, [dropboxChild]);
    await db.$client.query(
      "update discovery_queue_items set status = 'queued', last_error = null, completed_at = null where job_id = $1 and path = $2",
      [job.id, dropboxChild],
    );

    const res = await inventoryDirectory(drive).expect(200);

    expect(res.body.skippedQueueItems).toBe(2);
    expect((await statusesOf(job.id))[dropboxChild]).toBe('queued');
  });

  it('approving a file, or rejecting a directory, skips nothing', async () => {
    const sourceId = await createSource();
    const { job, drive } = await driveWithChildren(sourceId);
    const proposed = await propose(drive, [
      proposal(DRIVE),
      proposal(`${DRIVE}\\notes.txt`, { kind: 'file' }),
    ]).expect(200);
    const [dir, file] = proposed.body as { id: string; kind: string }[];
    const fileItem = file.kind === 'file' ? file : dir;
    const dirItem = file.kind === 'file' ? dir : file;

    await decide(fileItem.id, { decision: 'approved' }).expect(200);
    await decide(dirItem.id, { decision: 'rejected' }).expect(200);

    expect(await statusesOf(job.id)).toMatchObject({
      [FINANCE]: 'queued',
      [PHOTOS]: 'queued',
    });
    expect(await auditTypes(sourceId)).not.toContain('queue_items.inventoried');
  });
});
