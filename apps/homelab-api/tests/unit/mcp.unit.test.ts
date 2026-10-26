import { AddressInfo } from 'net';
import { Server } from 'http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createServer } from '../../src/server';
import * as discoveryService from '../../src/services/discovery';
import { completeQueueItemBodySchema } from '../../src/schemas/discovery';

jest.mock('../../src/services/discovery', () => {
  const actual = jest.requireActual('../../src/services/discovery');
  return {
    DiscoveryError: actual.DiscoveryError,
    listAllJobs: jest.fn(),
    getDiscoveryJob: jest.fn(),
    claimQueueItem: jest.fn(),
    claimAnyQueueItem: jest.fn(),
    releaseItem: jest.fn(),
    jobQueueCounts: jest.fn().mockResolvedValue({
      queued: 4,
      in_progress: 1,
      completed: 7,
      failed: 2,
      skipped: 0,
    }),
    heartbeat: jest.fn(),
    completeItem: jest.fn(),
    failItem: jest.fn(),
    skipItem: jest.fn(),
    retryItem: jest.fn(),
    listExclusionRules: jest.fn(),
    createExclusionRule: jest.fn(),
    proposeInventoryItems: jest.fn(),
    listSourceInventoryItems: jest.fn(),
    listSourceKnownSkips: jest.fn(),
  };
});

const ID = '3f1d1c52-6a4a-4a4e-9a3c-0f6d2a1b7c10';
const JOB_ID = '5b2c9a10-1111-4222-8333-944455556666';
const TOKEN = '8c1b0c3e-5a53-4a7c-8f4e-2b1f3d9a6e11';

// StreamableHTTPClientTransport performs real fetch calls, so this spins up a
// real listener on an ephemeral port rather than using supertest.
describe('MCP endpoint (/mcp)', () => {
  let server: Server;
  let baseUrl: URL;
  let client: Client;

  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as { type: string; text: string }[];
    return { isError: result.isError, body: JSON.parse(content[0].text) };
  };

  beforeAll(async () => {
    server = createServer().listen(0);
    const { port } = server.address() as AddressInfo;
    baseUrl = new URL(`http://127.0.0.1:${port}/mcp`);

    client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
  });

  afterAll(async () => {
    await client.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('lists only the agent-facing tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'claim_directory',
      'claim_next_directory',
      'complete_directory',
      'create_exclusion_rule',
      'fail_directory',
      'get_discovery_job',
      'heartbeat_directory',
      'list_discovery_jobs',
      'list_exclusion_rules',
      'list_inventory_items',
      'list_known_skips',
      'propose_inventory_items',
      'release_directory',
      'skip_directory',
    ]);
  });

  it('create_exclusion_rule records the rule as the openclaw actor', async () => {
    (discoveryService.createExclusionRule as jest.Mock).mockResolvedValue({
      id: ID,
    });

    const { isError, body } = await call('create_exclusion_rule', {
      sourceId: ID,
      path: 'C:\\Users\\You\\app\\dist',
      scope: 'exclude_subtree',
      reason: 'generated build output',
      workerId: 'w1',
    });

    expect(isError).toBeFalsy();
    expect(body).toEqual({ id: ID });
    expect(discoveryService.createExclusionRule).toHaveBeenCalledWith(
      {
        sourceId: ID,
        path: 'C:\\Users\\You\\app\\dist',
        scope: 'exclude_subtree',
        reason: 'generated build output',
      },
      { type: 'openclaw', id: 'w1' },
    );
  });

  it('create_exclusion_rule cannot create a global rule', async () => {
    (discoveryService.createExclusionRule as jest.Mock).mockClear();

    const result = await client.callTool({
      name: 'create_exclusion_rule',
      arguments: { path: 'C:\\Windows', scope: 'exclude_subtree' },
    });

    expect(result.isError).toBe(true);
    expect(discoveryService.createExclusionRule).not.toHaveBeenCalled();
  });

  it('list_exclusion_rules lists a source’s rules', async () => {
    (discoveryService.listExclusionRules as jest.Mock).mockResolvedValue([
      { id: ID },
    ]);

    const { body } = await call('list_exclusion_rules', { sourceId: ID });

    expect(body).toEqual([{ id: ID }]);
    expect(discoveryService.listExclusionRules).toHaveBeenCalledWith({
      sourceId: ID,
    });
  });

  it('claim_directory applies the lease default and returns a compact item', async () => {
    (discoveryService.claimQueueItem as jest.Mock).mockResolvedValue({
      item: {
        id: ID,
        path: 'C:\\Users\\You',
        normalizedPath: 'c:\\users\\you',
        reason: null,
        claimToken: TOKEN,
        claimedBy: 'w1',
        leaseExpiresAt: '2026-10-21T10:05:00.000Z',
        attemptCount: 1,
        maxAttempts: 3,
        lastError: null,
        createdAt: '2026-10-21T10:00:00.000Z',
      },
      job: { id: JOB_ID, sourceId: ID, rootPath: 'C:\\Users\\You' },
      queueCounts: { queued: 3, in_progress: 1, failed: 2 },
    });

    const { isError, body } = await call('claim_directory', {
      jobId: ID,
      workerId: 'w1',
    });

    expect(isError).toBeFalsy();
    expect(body).toEqual({
      id: ID,
      path: 'C:\\Users\\You',
      claimToken: TOKEN,
      leaseExpiresAt: '2026-10-21T10:05:00.000Z',
      attempt: '1/3',
      jobId: JOB_ID,
      sourceId: ID,
      jobRootPath: 'C:\\Users\\You',
      remaining: { queued: 3, inProgress: 1, failed: 2 },
    });
    expect(discoveryService.claimQueueItem).toHaveBeenCalledWith(ID, 'w1', 300);
  });

  it.each([
    ['queue_empty', 'stop', null],
    ['retry_backoff', 'wait', '2026-10-21T10:10:00.000Z'],
    ['in_progress', 'wait', '2026-10-21T10:05:00.000Z'],
  ])(
    'claim_directory idle %s tells the agent to %s',
    async (reason, next, retryAt) => {
      const queueCounts = { queued: 0, in_progress: 0 };
      (discoveryService.claimQueueItem as jest.Mock).mockResolvedValue({
        item: null,
        reason,
        retryAt,
        queueCounts,
      });

      const { body } = await call('claim_directory', {
        jobId: ID,
        workerId: 'w1',
      });

      expect(body).toEqual({
        idle: reason,
        next,
        ...(retryAt ? { retryAt } : {}),
        queueCounts,
      });
    },
  );

  it('claim_next_directory passes the optional source and tells an empty tick to stop', async () => {
    (discoveryService.claimAnyQueueItem as jest.Mock).mockResolvedValue({
      item: null,
      reason: 'queue_empty',
      retryAt: null,
      queueCounts: { queued: 0, failed: 1 },
    });

    const { isError, body } = await call('claim_next_directory', {
      workerId: 'w1',
      sourceId: ID,
    });

    expect(isError).toBeFalsy();
    expect(body).toEqual({
      idle: 'queue_empty',
      next: 'stop',
      queueCounts: { queued: 0, failed: 1 },
    });
    expect(discoveryService.claimAnyQueueItem).toHaveBeenCalledWith(
      'w1',
      300,
      ID,
    );
  });

  it('release_directory hands the claim back', async () => {
    (discoveryService.releaseItem as jest.Mock).mockResolvedValue({
      id: ID,
      status: 'queued',
    });

    const { isError, body } = await call('release_directory', {
      id: ID,
      claimToken: TOKEN,
    });

    expect(isError).toBeFalsy();
    expect(body).toEqual({ status: 'queued' });
    expect(discoveryService.releaseItem).toHaveBeenCalledWith(ID, TOKEN);
  });

  it('complete_directory reports queued, excluded and already queued children', async () => {
    (discoveryService.completeItem as jest.Mock).mockResolvedValue({
      item: { id: ID, status: 'completed' },
      children: [
        { item: { path: 'C:\\a', status: 'queued' }, created: true },
        { item: { path: 'C:\\b', status: 'skipped' }, created: true },
        { item: { path: 'C:\\c', status: 'queued' }, created: false },
      ],
    });

    const { body } = await call('complete_directory', {
      id: ID,
      claimToken: TOKEN,
      discoveredPaths: ['C:\\Users\\You\\Docs'],
    });

    expect(body).toEqual({
      status: 'completed',
      remaining: { queued: 4, inProgress: 1, failed: 2 },
      queued: ['C:\\a'],
      excluded: ['C:\\b'],
      failed: [],
      alreadyQueued: 1,
    });
  });

  it('complete_directory passes follow-up reasons, summary and skipped paths', async () => {
    (discoveryService.completeItem as jest.Mock).mockResolvedValue({
      item: { id: ID },
      children: [],
    });

    await call('complete_directory', {
      id: ID,
      claimToken: TOKEN,
      discoveredPaths: [{ path: 'C:\\code', reason: 'likely repos' }],
      summary: 'root assessed',
      skipped: [{ path: 'C:\\Windows', reason: 'operating system' }],
    });

    expect(discoveryService.completeItem).toHaveBeenCalledWith(
      ID,
      TOKEN,
      [{ path: 'C:\\code', reason: 'likely repos' }],
      {
        summary: 'root assessed',
        skipped: [{ path: 'C:\\Windows', reason: 'operating system' }],
        skippedGroups: [],
        unreadable: [],
      },
    );
  });

  it('complete_directory passes pattern skips and rejects bad patterns', async () => {
    (discoveryService.completeItem as jest.Mock).mockClear();
    (discoveryService.completeItem as jest.Mock).mockResolvedValue({
      item: { id: ID },
      children: [],
    });
    const group = { pattern: '*.msi', count: 212, reason: 'installers' };

    await call('complete_directory', {
      id: ID,
      claimToken: TOKEN,
      skippedGroups: [group],
    });
    expect(discoveryService.completeItem).toHaveBeenCalledWith(ID, TOKEN, [], {
      summary: undefined,
      skipped: [],
      skippedGroups: [group],
      unreadable: [],
    });

    for (const pattern of ['*', 'installer.msi', '*\\*.msi', 'a/*.msi']) {
      expect(
        completeQueueItemBodySchema.safeParse({
          claimToken: TOKEN,
          skippedGroups: [{ pattern, reason: 'x' }],
        }).success,
      ).toBe(false);
    }
  });

  it('propose_inventory_items has no decision field', async () => {
    (discoveryService.proposeInventoryItems as jest.Mock).mockResolvedValue([
      {
        inventoryItem: {
          id: ID,
          rootPath: 'C:\\Users\\You\\Documents',
          decision: 'pending',
          evidence: { observations: ['big'] },
        },
        created: true,
        changed: false,
        coveredBy: [
          {
            id: 'p1',
            kind: 'directory',
            rootPath: 'C:\\Users\\You',
            displayName: 'You',
            recommendation: 'back_up',
            decision: 'approved',
          },
        ],
        covers: [],
      },
    ]);

    const { isError, body } = await call('propose_inventory_items', {
      id: ID,
      claimToken: TOKEN,
      inventoryItems: [
        {
          rootPath: 'C:\\Users\\You\\Documents',
          kind: 'directory',
          summary: 'Personal documents',
          recommendation: 'back_up',
          confidence: 'high',
          reason: 'Documents folder',
          evidence: {
            contentKinds: ['personal_documents'],
            git: null,
            reproducible: 'no',
            sufficientInformation: true,
            observations: [],
            openQuestions: [],
          },
        },
      ],
    });

    expect(isError).toBeFalsy();
    expect(body).toEqual([
      {
        id: ID,
        rootPath: 'C:\\Users\\You\\Documents',
        created: true,
        changed: false,
        decision: 'pending',
        coveredBy: [
          {
            rootPath: 'C:\\Users\\You',
            kind: 'directory',
            decision: 'approved',
          },
        ],
        covers: [],
      },
    ]);
    expect(discoveryService.proposeInventoryItems).toHaveBeenCalledWith(
      ID,
      TOKEN,
      expect.any(Array),
    );
  });

  it('propose_inventory_items rejects low-confidence back_up', async () => {
    (discoveryService.proposeInventoryItems as jest.Mock).mockClear();

    const result = await client.callTool({
      name: 'propose_inventory_items',
      arguments: {
        id: ID,
        claimToken: TOKEN,
        inventoryItems: [
          {
            rootPath: 'C:\\data',
            kind: 'directory',
            summary: 's',
            recommendation: 'back_up',
            confidence: 'low',
            reason: 'r',
            evidence: {
              contentKinds: [],
              git: null,
              reproducible: 'unknown',
              sufficientInformation: false,
              observations: [],
              openQuestions: [],
            },
          },
        ],
      },
    });

    expect(result.isError).toBe(true);
    expect(discoveryService.proposeInventoryItems).not.toHaveBeenCalled();
  });

  it('has no record_discovered_items tool and describes inventory items as the only record', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);

    expect(names).not.toContain('record_discovered_items');
    expect(
      tools.find((t) => t.name === 'propose_inventory_items')?.description,
    ).toMatch(/queues nothing/i);
  });

  it('list_known_skips passes the source and filters through', async () => {
    (discoveryService.listSourceKnownSkips as jest.Mock).mockResolvedValue([
      { path: 'C:\\Windows', reason: 'operating system' },
    ]);

    const { isError, body } = await call('list_known_skips', {
      sourceId: ID,
      pathPrefix: 'C:\\',
    });

    expect(isError).toBeFalsy();
    expect(body).toEqual([{ path: 'C:\\Windows', reason: 'operating system' }]);
    expect(discoveryService.listSourceKnownSkips).toHaveBeenCalledWith(ID, {
      pathPrefix: 'C:\\',
      limit: 200,
    });
  });

  it('serves the agent playbook as server instructions', () => {
    expect(client.getInstructions()).toContain('inventory items');
    expect(client.getInstructions()).toContain('claim_next_directory');
  });

  it('keeps the playbook and tool descriptions short', async () => {
    expect(client.getInstructions().length).toBeLessThanOrEqual(5000);

    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.description.length).toBeLessThanOrEqual(400);
    }
  });

  it('list_inventory_items returns compact items and a cursor on a full page', async () => {
    (discoveryService.listSourceInventoryItems as jest.Mock).mockResolvedValue({
      total: 9,
      items: [
        {
          id: ID,
          rootPath: 'C:\\a',
          normalizedRootPath: 'c:\\a',
          kind: 'directory',
          recommendation: 'back_up',
          confidence: 'high',
          decision: 'pending',
          decisionNote: null,
          summary: 'docs',
          evidence: {},
          decidedBy: null,
        },
      ],
    });

    const { body } = await call('list_inventory_items', {
      sourceId: ID,
      limit: 1,
    });

    expect(body).toEqual({
      total: 9,
      items: [
        {
          id: ID,
          rootPath: 'C:\\a',
          kind: 'directory',
          recommendation: 'back_up',
          confidence: 'high',
          decision: 'pending',
          summary: 'docs',
        },
      ],
      next: 'c:\\a',
    });
  });

  it('reports a DiscoveryError as a tool error with details', async () => {
    (discoveryService.getDiscoveryJob as jest.Mock).mockRejectedValue(
      new discoveryService.DiscoveryError('not_found', 'job not found'),
    );

    const { isError, body } = await call('get_discovery_job', { id: ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ code: 'not_found', message: 'job not found' });
  });

  it('rejects a malformed claimToken before reaching the service', async () => {
    const result = await client.callTool({
      name: 'fail_directory',
      arguments: { id: ID, claimToken: 'nope', error: 'boom' },
    });

    expect(result.isError).toBe(true);
    expect(discoveryService.failItem).not.toHaveBeenCalled();
  });

  it('rejects GET with 405', async () => {
    const res = await fetch(baseUrl, { method: 'GET' });
    expect(res.status).toBe(405);
  });
});
