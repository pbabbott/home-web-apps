import {
  createSource,
  recordBackupDestinationValidation,
} from '@abbottland/homelab-db';
import { db } from '../../src/db';
import {
  WORKER,
  makeDestination,
  makeInventoryItem,
  makeSource,
  api,
  create,
  jobCount,
  plan,
  useBackupApiCleanup,
  verifyAll,
} from './fixtures/backup';

useBackupApiCleanup();

describe('planning', () => {
  /** Approved file and directory with a nested file and a rejected child, plus the other decisions. */
  const seed = async () => {
    const sourceId = await makeSource();
    const destination = await makeDestination();
    const file = await makeInventoryItem(sourceId, 'C:\\data\\a.txt');
    const dir = await makeInventoryItem(sourceId, 'C:\\data\\dir', {
      kind: 'directory',
    });
    const nested = await makeInventoryItem(sourceId, 'C:\\data\\dir\\n.txt');
    const rejectedChild = await makeInventoryItem(
      sourceId,
      'C:\\data\\dir\\skip',
      { kind: 'directory', decision: 'rejected' },
    );
    const pending = await makeInventoryItem(sourceId, 'C:\\data\\p.txt', {
      decision: 'pending',
    });
    const rejected = await makeInventoryItem(sourceId, 'C:\\data\\f.txt', {
      decision: 'rejected',
    });
    const excluded = await makeInventoryItem(sourceId, 'C:\\cache\\x', {
      kind: 'directory',
    });
    await api()
      .post('/exclusion-rules')
      .send({ sourceId, path: 'C:\\cache', scope: 'exclude_subtree' })
      .expect(201);

    return {
      sourceId,
      destination,
      file,
      dir,
      nested,
      rejectedChild,
      pending,
      rejected,
      excluded,
    };
  };

  it('plans every case and writes nothing', async () => {
    const s = await seed();

    const res = await plan(s.sourceId, {
      destinationId: s.destination.id,
    }).expect(200);

    expect(res.body.summary).toMatchObject({
      toCopy: 2,
      skippedRedundantNested: 1,
      skippedAlreadyCovered: 0,
      excluded: 1,
      notEligible: 3,
      unestimatedItems: 2,
    });
    const byPath = Object.fromEntries(
      res.body.items.map((i: { rootPath: string }) => [i.rootPath, i]),
    );
    expect(byPath['C:\\data\\a.txt']).toMatchObject({
      status: 'queued',
      destRelPath: 'C/data/a.txt',
    });
    expect(byPath['C:\\data\\dir']).toMatchObject({
      status: 'queued',
      carveOuts: [
        {
          path: 'C:\\data\\dir\\skip',
          reason: 'rejected_item',
          refId: s.rejectedChild.id,
        },
      ],
    });
    expect(byPath['C:\\data\\dir\\n.txt']).toMatchObject({
      status: 'skipped',
      statusReason: 'redundant_nested',
      coveredByInventoryItemId: s.dir.id,
    });
    expect(byPath['C:\\cache\\x']).toMatchObject({
      status: 'excluded',
      statusReason: 'excluded_by_rule',
    });
    expect(
      res.body.notEligible.map((n: { decision: string }) => n.decision).sort(),
    ).toEqual(['pending', 'rejected', 'rejected']);
    expect(res.body.sourceDirName).toMatch(/^backup-test-/);
    expect(await jobCount(s.sourceId)).toBe(0);
  });

  it('applies a selection', async () => {
    const s = await seed();

    const res = await plan(s.sourceId, {
      destinationId: s.destination.id,
      inventoryItemIds: [s.file.id],
    }).expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.selection.inventoryItemIds).toEqual([s.file.id]);
  });

  it('rejects an empty selection and one with nothing approved', async () => {
    const s = await seed();

    const none = await plan(s.sourceId, {
      destinationId: s.destination.id,
      pathPrefix: 'D:\\nothing',
    }).expect(409);
    expect(none.body.message).toMatch(/matches no inventory items/);

    const notApproved = await plan(s.sourceId, {
      destinationId: s.destination.id,
      inventoryItemIds: [s.pending.id, s.rejected.id],
    }).expect(409);
    expect(notApproved.body.notEligible).toHaveLength(2);
    expect(await jobCount(s.sourceId)).toBe(0);
  });

  it('refuses a second active job, a disabled destination and unknown ids', async () => {
    const s = await seed();
    const first = await create(s.sourceId, {
      destinationId: s.destination.id,
    }).expect(201);

    const again = await create(s.sourceId, {
      destinationId: s.destination.id,
    }).expect(409);
    expect(again.body.jobId).toBe(first.body.id);
    await plan(s.sourceId, { destinationId: s.destination.id }).expect(409);
    expect(await jobCount(s.sourceId)).toBe(1);

    const other = await makeDestination({ enabled: false });
    await plan(s.sourceId, { destinationId: other.id }).expect(409);
    await create(s.sourceId, { destinationId: other.id }).expect(409);

    await plan(crypto.randomUUID(), { destinationId: s.destination.id }).expect(
      404,
    );
    await plan(s.sourceId, { destinationId: crypto.randomUUID() }).expect(404);
  });

  it('warns about a running discovery job', async () => {
    const s = await seed();
    const before = await plan(s.sourceId, {
      destinationId: s.destination.id,
    }).expect(200);
    expect(
      before.body.warnings.map((w: { code: string }) => w.code),
    ).not.toContain('discovery_job_active');

    await api()
      .post(`/sources/${s.sourceId}/discovery-jobs`)
      .send({ rootPath: 'C:\\data' })
      .expect(201);

    const after = await plan(s.sourceId, {
      destinationId: s.destination.id,
    }).expect(200);
    expect(after.body.warnings.map((w: { code: string }) => w.code)).toContain(
      'discovery_job_active',
    );
  });

  it('warns about the source folder from what the destination reported', async () => {
    const s = await seed();
    const codes = async () =>
      (
        await plan(s.sourceId, { destinationId: s.destination.id }).expect(200)
      ).body.warnings.map((w: { code: string }) => w.code);
    const dirName = (
      await plan(s.sourceId, { destinationId: s.destination.id })
    ).body.sourceDirName;

    expect(await codes()).toContain('destination_folder_unknown');

    await recordBackupDestinationValidation(db, s.destination.id, {
      workerId: WORKER.id,
      validation: { ok: true, rootEntries: ['unrelated', dirName] },
    });
    expect(await codes()).toContain('destination_folder_exists');

    await recordBackupDestinationValidation(db, s.destination.id, {
      workerId: WORKER.id,
      validation: { ok: true, rootEntries: ['unrelated'] },
    });
    expect(await codes()).toEqual([]);
  });

  it('refuses a folder name another source already uses at the destination', async () => {
    const s = await seed();
    const first = await create(s.sourceId, {
      destinationId: s.destination.id,
    }).expect(201);
    const folder = first.body.sourceDirName;
    const sourceRow = await db.$client.query(
      'select name from sources where id = $1',
      [s.sourceId],
    );

    const twin = await createSource(db, {
      name: sourceRow.rows[0].name.toUpperCase(),
    });
    try {
      await makeInventoryItem(twin.id, 'C:\\data\\a.txt');
      const res = await plan(twin.id, {
        destinationId: s.destination.id,
      }).expect(409);
      expect(res.body.message).toContain(`"${folder}"`);
    } finally {
      await db.$client.query('delete from sources where id = $1', [twin.id]);
    }
  });

  it('skips verified items and reuses their destination path on the next job', async () => {
    const s = await seed();
    const first = await create(s.sourceId, {
      destinationId: s.destination.id,
    }).expect(201);
    await verifyAll(s.destination.id, first.body.id);

    const res = await plan(s.sourceId, {
      destinationId: s.destination.id,
    }).expect(200);
    const status = (path: string) =>
      res.body.items.find((i: { rootPath: string }) => i.rootPath === path);
    expect(status('C:\\data\\a.txt')).toMatchObject({
      status: 'skipped',
      statusReason: 'already_covered',
    });
    expect(status('C:\\data\\dir')).toMatchObject({
      status: 'skipped',
      statusReason: 'already_covered',
    });
    expect(res.body.sourceDirName).toBe(first.body.sourceDirName);

    const forced = await plan(s.sourceId, {
      destinationId: s.destination.id,
      skipAlreadyCovered: false,
    }).expect(200);
    expect(forced.body.summary.skippedAlreadyCovered).toBe(0);
    expect(forced.body.summary.toCopy).toBeGreaterThanOrEqual(2);
  });
});
