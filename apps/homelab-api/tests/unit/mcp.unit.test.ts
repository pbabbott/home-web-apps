import { AddressInfo } from 'net';
import { Server } from 'http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createServer } from '../../src/server';
import * as discoveryService from '../../src/services/discovery';

jest.mock('../../src/services/discovery', () => {
  const actual = jest.requireActual('../../src/services/discovery');
  return {
    DiscoveryError: actual.DiscoveryError,
    listAllJobs: jest.fn(),
    getDiscoveryJob: jest.fn(),
    claimQueueItem: jest.fn(),
    heartbeat: jest.fn(),
    recordInventory: jest.fn(),
    completeItem: jest.fn(),
    failItem: jest.fn(),
    skipItem: jest.fn(),
    retryItem: jest.fn(),
  };
});

const ID = '3f1d1c52-6a4a-4a4e-9a3c-0f6d2a1b7c10';
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

  it('lists only the discovery work-loop tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'claim_directory',
      'complete_directory',
      'fail_directory',
      'get_discovery_job',
      'heartbeat_directory',
      'list_discovery_jobs',
      'record_discovered_items',
      'retry_directory',
      'skip_directory',
    ]);
  });

  it('claim_directory applies the lease default and returns the service result', async () => {
    (discoveryService.claimQueueItem as jest.Mock).mockResolvedValue({
      item: { id: ID },
    });

    const { isError, body } = await call('claim_directory', {
      jobId: ID,
      workerId: 'w1',
    });

    expect(isError).toBeFalsy();
    expect(body).toEqual({ item: { id: ID } });
    expect(discoveryService.claimQueueItem).toHaveBeenCalledWith(ID, 'w1', 300);
  });

  it('complete_directory flattens children like the REST route', async () => {
    (discoveryService.completeItem as jest.Mock).mockResolvedValue({
      item: { id: ID, status: 'completed' },
      children: [{ item: { id: 'c1' }, created: true }],
    });

    const { body } = await call('complete_directory', {
      id: ID,
      claimToken: TOKEN,
      discoveredPaths: ['C:\\Users\\You\\Docs'],
    });

    expect(body).toEqual({
      id: ID,
      status: 'completed',
      children: [{ id: 'c1', created: true }],
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
