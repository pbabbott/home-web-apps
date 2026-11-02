import { db } from '../../../src/db';
import { getRequest } from '../../jest.integration.setup';
import { evidence, type ClaimedItem } from './selective-agent';

// Runs against the real local dev Postgres, so everything created here is
// deleted afterwards. Sources cascade to jobs, queue items,
// inventory items and source-level rules; global rules and the audit log (which has
// no foreign keys by design) are removed explicitly.
const createdSourceIds: string[] = [];
const createdRuleIds: string[] = [];

/** Registers the cleanup hook for everything the helpers below create. */
export const useInventoryCleanup = (): void => {
  afterEach(async () => {
    await db.$client.query(
      'delete from audit_events where source_id = any($1) or exclusion_rule_id = any($2)',
      [createdSourceIds, createdRuleIds],
    );
    await db.$client.query('delete from exclusion_rules where id = any($1)', [
      createdRuleIds,
    ]);
    await db.$client.query('delete from sources where id = any($1)', [
      createdSourceIds,
    ]);
    createdSourceIds.length = 0;
    createdRuleIds.length = 0;
  });
};

export const unique = () => Math.random().toString(36).slice(2);
export const ROOT = 'C:\\code';

export const createSource = async (): Promise<string> => {
  const res = await getRequest()
    .post('/sources')
    .send({ name: `exodus-cand-${unique()}` })
    .expect(201);
  createdSourceIds.push(res.body.id);

  return res.body.id;
};

export const createRule = async (body: {
  sourceId?: string | null;
  path: string;
  scope: 'selective_only' | 'exclude_subtree';
}) => {
  const res = await getRequest()
    .post('/exclusion-rules')
    .send(body)
    .expect(201);
  createdRuleIds.push(res.body.id);

  return res.body as { id: string };
};

export type Job = { id: string };

/** Starts a job and claims its root directory. */
export const startAndClaim = async (sourceId: string, rootPath = ROOT) => {
  const job = (
    await getRequest()
      .post(`/sources/${sourceId}/discovery-jobs`)
      .send({ rootPath })
      .expect(201)
  ).body as Job;
  const res = await getRequest()
    .post(`/discovery-jobs/${job.id}/queue-items/claim`)
    .send({ workerId: 'w1', leaseSeconds: 300 })
    .expect(200);

  return { job, item: res.body.item as ClaimedItem };
};

export const finish = async (job: Job, item: ClaimedItem) => {
  await getRequest()
    .post(`/queue-items/${item.id}/complete`)
    .send({ claimToken: item.claimToken })
    .expect(200);
  await getRequest().post(`/discovery-jobs/${job.id}/complete`).expect(200);
};

export const proposal = (
  path: string,
  overrides: Record<string, unknown> = {},
) => ({
  rootPath: path,
  kind: 'directory',
  summary: 'A project',
  recommendation: 'back_up',
  confidence: 'high',
  reason: 'Has local work',
  evidence: evidence({ contentKinds: ['source_code'] }),
  ...overrides,
});

export const propose = (item: ClaimedItem, inventoryItems: object[]) =>
  getRequest()
    .post(`/queue-items/${item.id}/inventory-items`)
    .send({ claimToken: item.claimToken, inventoryItems });

export const listInventoryPage = async (
  sourceId: string,
  query: Record<string, string> = {},
) =>
  (
    await getRequest()
      .get(`/sources/${sourceId}/inventory-items`)
      .query(query)
      .expect(200)
  ).body as { items: Record<string, any>[]; total: number };

export const listInventoryItems = async (
  sourceId: string,
  query: Record<string, string> = {},
) => (await listInventoryPage(sourceId, query)).items;

export const decide = (
  id: string,
  body: object,
  headers: Record<string, string> = { 'X-Actor-Id': 'brandon' },
) =>
  getRequest().patch(`/inventory-items/${id}/decision`).set(headers).send(body);

export const inventoryItemEvents = async (inventoryItemId: string) =>
  (
    await getRequest()
      .get('/audit-events')
      .query({ inventoryItemId: inventoryItemId })
      .expect(200)
  ).body as {
    eventType: string;
    actorType: string;
    actorId: string | null;
    details: Record<string, any>;
  }[];

/** Proposes one inventory item in a fresh, completed job and returns it. */
export const proposeInNewJob = async (
  sourceId: string,
  path: string,
  overrides: Record<string, unknown> = {},
) => {
  const { job, item } = await startAndClaim(sourceId);
  const res = await propose(item, [proposal(path, overrides)]).expect(200);
  await finish(job, item);

  return { job, inventoryItem: res.body[0] as Record<string, any> };
};
