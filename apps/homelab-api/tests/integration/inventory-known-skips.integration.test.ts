import { getRequest } from '../jest.integration.setup';
import {
  ROOT,
  decide,
  finish,
  propose,
  proposal,
  startAndClaim,
  createSource,
  useInventoryCleanup,
} from './fixtures/inventory';

useInventoryCleanup();

describe('known skips across jobs', () => {
  const skipsOf = async (
    sourceId: string,
    query: Record<string, string> = {},
  ) =>
    (
      await getRequest()
        .get(`/sources/${sourceId}/known-skips`)
        .query(query)
        .expect(200)
    ).body as {
      path: string;
      reason: string;
      skippedAt: string;
      jobId: string;
      pattern?: string;
      count?: number;
    }[];

  /** Runs and finishes a job whose root directory records `skipped`. */
  const runSkipping = async (
    sourceId: string,
    skipped: { path: string; reason: string }[],
  ) => {
    const { job, item } = await startAndClaim(sourceId);
    await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send({ claimToken: item.claimToken, skipped })
      .expect(200);
    await getRequest().post(`/discovery-jobs/${job.id}/complete`).expect(200);

    return job;
  };

  it('shows a later job the paths an earlier job skipped, newest reason per path', async () => {
    const sourceId = await createSource();
    const first = await runSkipping(sourceId, [
      { path: `${ROOT}\\cache`, reason: 'generated' },
      { path: `${ROOT}\\Windows`, reason: 'operating system' },
    ]);
    expect((await skipsOf(sourceId)).map((s) => s.jobId)).toEqual([
      first.id,
      first.id,
    ]);

    // Same path spelled differently, with a newer reason; plus a new path.
    const second = await runSkipping(sourceId, [
      { path: 'c:/CODE/Cache/', reason: 'build output, regenerated daily' },
      { path: `${ROOT}\\tmp`, reason: 'scratch' },
    ]);

    const skips = await skipsOf(sourceId);
    expect(skips.map((s) => [s.path, s.reason, s.jobId])).toEqual([
      // The newest spelling of the path wins, like other display paths.
      ['C:\\CODE\\Cache', 'build output, regenerated daily', second.id],
      ['C:\\code\\tmp', 'scratch', second.id],
      ['C:\\code\\Windows', 'operating system', first.id],
    ]);
    expect(Date.parse(skips[0].skippedAt)).toBeGreaterThan(0);
  });

  it('filters by path prefix, limits, and stays within the source', async () => {
    const sourceId = await createSource();
    await runSkipping(sourceId, [
      { path: `${ROOT}\\a\\one`, reason: 'x' },
      { path: `${ROOT}\\a\\two`, reason: 'x' },
      { path: `${ROOT}\\ab`, reason: 'x' },
    ]);

    expect(
      (await skipsOf(sourceId, { pathPrefix: `${ROOT}\\a` })).map(
        (s) => s.path,
      ),
    ).toEqual(['C:\\code\\a\\one', 'C:\\code\\a\\two']);
    expect(await skipsOf(sourceId, { limit: '1' })).toHaveLength(1);
    expect(await skipsOf(await createSource())).toEqual([]);
    await getRequest()
      .get('/sources/123e4567-e89b-12d3-a456-426614174000/known-skips')
      .expect(404);
  });

  it('remembers pattern skips against their directory, newest reason per pattern', async () => {
    const sourceId = await createSource();
    const downloads = 'C:\\Users\\You\\Downloads';
    const runGrouping = async (
      skippedGroups: { pattern: string; count?: number; reason: string }[],
    ) => {
      const { job, item } = await startAndClaim(sourceId, downloads);
      await getRequest()
        .post(`/queue-items/${item.id}/complete`)
        .send({ claimToken: item.claimToken, skippedGroups })
        .expect(200);
      await getRequest().post(`/discovery-jobs/${job.id}/complete`).expect(200);

      return job;
    };

    await runGrouping([
      { pattern: '*.msi', count: 100, reason: 'installers' },
      { pattern: '*.crdownload', reason: 'partial downloads' },
    ]);
    const second = await runGrouping([
      { pattern: '*.MSI', count: 212, reason: 'installers and updaters' },
    ]);

    const skips = await skipsOf(sourceId);
    expect(skips.map((s) => [s.path, s.pattern, s.count, s.reason])).toEqual([
      [downloads, '*.crdownload', undefined, 'partial downloads'],
      [downloads, '*.MSI', 212, 'installers and updaters'],
    ]);
    expect(skips[1].jobId).toBe(second.id);

    expect(
      await skipsOf(sourceId, { pathPrefix: 'C:\\Users\\You\\Documents' }),
    ).toEqual([]);
    expect(await skipsOf(sourceId, { pathPrefix: 'C:\\Users' })).toHaveLength(
      2,
    );
  });

  it('rejects an invalid pattern skip', async () => {
    const sourceId = await createSource();
    const { item } = await startAndClaim(sourceId);
    await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send({
        claimToken: item.claimToken,
        skippedGroups: [{ pattern: '*', reason: 'everything' }],
      })
      .expect(400);
  });

  it('is a record of judgments, not a rule: it blocks neither queueing nor proposals', async () => {
    const sourceId = await createSource();
    await runSkipping(sourceId, [
      { path: `${ROOT}\\cache`, reason: 'generated' },
    ]);

    expect(
      (
        await getRequest()
          .get('/exclusion-rules')
          .query({ sourceId })
          .expect(200)
      ).body,
    ).toEqual([]);

    const { item } = await startAndClaim(sourceId);
    await propose(item, [proposal(`${ROOT}\\cache`)]).expect(200);
    const done = await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send({
        claimToken: item.claimToken,
        discoveredPaths: [`${ROOT}\\cache\\deep`],
      })
      .expect(200);
    expect(done.body.children[0].status).toBe('queued');
  });
});

describe('nested inventory items', () => {
  it('reports the inventory items a proposal sits inside or contains', async () => {
    const sourceId = await createSource();
    const { job, item } = await startAndClaim(sourceId);

    const first = await propose(item, [
      proposal(`${ROOT}\\repo`),
      proposal(`${ROOT}\\repo2`),
    ]).expect(200);
    expect(first.body[0].coveredBy).toEqual([]);
    expect(first.body[0].covers).toEqual([]);

    const res = await propose(item, [
      proposal(`${ROOT}\\REPO\\packages\\app`),
    ]).expect(200);
    const parent = first.body[0];
    expect(res.body[0].covers).toEqual([]);
    expect(res.body[0].coveredBy).toEqual([
      expect.objectContaining({
        id: parent.id,
        rootPath: parent.rootPath,
        decision: 'pending',
      }),
    ]);

    // Re-proposing the parent now reports the child, but not repo2.
    const again = await propose(item, [proposal(`${ROOT}\\repo`)]).expect(200);
    expect(again.body[0].covers).toEqual([
      expect.objectContaining({ id: res.body[0].id }),
    ]);
    expect(again.body[0].coveredBy).toEqual([]);

    await finish(job, item);
  });

  it('reports batch siblings to each other and includes the ancestor decision', async () => {
    const sourceId = await createSource();
    const { item } = await startAndClaim(sourceId);
    const parent = (
      await propose(item, [proposal(`${ROOT}\\mono`)]).expect(200)
    ).body[0];
    await decide(parent.id, { decision: 'approved' }).expect(200);

    const res = await propose(item, [
      proposal(`${ROOT}\\mono\\a`),
      proposal(`${ROOT}\\mono\\a\\b`),
    ]).expect(200);

    expect(res.body[0].coveredBy).toEqual([
      expect.objectContaining({ id: parent.id, decision: 'approved' }),
    ]);
    expect(res.body[0].covers).toEqual([
      expect.objectContaining({ id: res.body[1].id }),
    ]);
    expect(res.body[1].coveredBy.map((c: { id: string }) => c.id)).toEqual([
      parent.id,
      res.body[0].id,
    ]);
  });
});
