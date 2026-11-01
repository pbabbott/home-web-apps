import { getRequest } from '../jest.integration.setup';
import {
  ROOT,
  decide,
  finish,
  propose,
  proposal,
  startAndClaim,
  createRule,
  createSource,
  useInventoryCleanup,
} from './fixtures/inventory';

useInventoryCleanup();

describe('checking a path for coverage', () => {
  const check = (sourceId: string, path: string) =>
    getRequest().get(`/sources/${sourceId}/path-coverage`).query({ path });

  it('reports an approved ancestor, nested rejection and the visited directory', async () => {
    const sourceId = await createSource();
    const { job, item } = await startAndClaim(sourceId);
    const res = await propose(item, [
      proposal(`${ROOT}\\app`),
      proposal(`${ROOT}\\app\\vendor`),
    ]).expect(200);
    const [app, vendor] = res.body as { id: string; rootPath: string }[];
    const outer = app.rootPath === `${ROOT}\\app` ? app : vendor;
    const inner = outer === app ? vendor : app;

    await decide(outer.id, { decision: 'approved' }).expect(200);
    await finish(job, item);

    const covered = (await check(sourceId, `${ROOT}\\app\\src\\deep\\x.ts`))
      .body;
    expect(covered.status).toBe('covered');
    expect(covered.decidingItem.id).toBe(outer.id);
    expect(covered.exact).toBeNull();
    expect(covered.visitedDirectory).toMatchObject({
      id: item.id,
      jobId: job.id,
      path: ROOT,
    });

    await decide(inner.id, { decision: 'rejected' }).expect(200);

    const carved = (await check(sourceId, `${ROOT}\\APP\\vendor\\lib`)).body;
    expect(carved.status).toBe('carved_out');
    expect(carved.decidingItem.id).toBe(inner.id);

    const exact = (await check(sourceId, `${ROOT}\\app`)).body;
    expect(exact.status).toBe('covered');
    expect(exact.exact.id).toBe(outer.id);
    expect(exact.coveredBy).toEqual([]);
    expect(exact.covers.map((c: { id: string }) => c.id)).toEqual([inner.id]);
  });

  it('is uncovered, pending and 404/400 where it should be', async () => {
    const sourceId = await createSource();
    const { job, item } = await startAndClaim(sourceId);
    const res = await propose(item, [proposal(`${ROOT}\\app`)]).expect(200);
    await finish(job, item);

    expect((await check(sourceId, `${ROOT}\\other\\file`)).body).toMatchObject({
      status: 'uncovered',
      decidingItem: null,
    });
    expect((await check(sourceId, `${ROOT}\\app\\x`)).body).toMatchObject({
      status: 'pending',
      decidingItem: { id: res.body[0].id },
    });

    await check('00000000-0000-4000-8000-000000000000', ROOT).expect(404);
    await check(sourceId, 'relative\\path').expect(400);
  });

  it('reports exclusion rules and agent skips', async () => {
    const sourceId = await createSource();
    const rule = await createRule({
      sourceId,
      path: `${ROOT}\\node_modules`,
      scope: 'exclude_subtree',
    });
    const { job, item } = await startAndClaim(sourceId);
    await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send({
        claimToken: item.claimToken,
        skipped: [{ path: `${ROOT}\\cache`, reason: 'regenerable' }],
        skippedGroups: [{ pattern: '*.tmp', count: 3, reason: 'temp files' }],
      })
      .expect(200);
    await getRequest().post(`/discovery-jobs/${job.id}/complete`).expect(200);

    const excluded = (await check(sourceId, `${ROOT}\\node_modules\\a\\b`))
      .body;
    expect(excluded.exclusion).toEqual({
      state: 'excluded',
      ruleIds: [rule.id],
    });

    expect(
      (await check(sourceId, `${ROOT}\\cache\\deep\\f`)).body.skip,
    ).toMatchObject({
      path: `${ROOT}\\cache`,
      reason: 'regenerable',
      jobId: job.id,
    });
    expect(
      (await check(sourceId, `${ROOT}\\junk.tmp`)).body.skip,
    ).toMatchObject({
      pattern: '*.tmp',
      reason: 'temp files',
    });
    expect((await check(sourceId, `${ROOT}\\keep.txt`)).body.skip).toBeNull();
  });
});
