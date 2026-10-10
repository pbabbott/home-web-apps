import { AddressInfo } from 'net';
import { Server } from 'http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createServer } from '../../src/server';
import * as gluetunApi from '../../src/api/gluetun/gluetun';
import * as qbittorrentApi from '../../src/api/qbittorrent';

jest.mock('../../src/api/gluetun/gluetun');
jest.mock('../../src/api/qbittorrent');

// StreamableHTTPClientTransport performs real fetch calls, so this spins up a
// real listener on an ephemeral port rather than using supertest's in-memory
// dispatch.
describe('MCP endpoint (/mcp)', () => {
  let server: Server;
  let baseUrl: URL;
  let client: Client;

  beforeAll(async () => {
    const httpServer = createServer().listen(0);
    server = httpServer;
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = new URL(`http://127.0.0.1:${port}/mcp`);

    client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(new StreamableHTTPClientTransport(baseUrl));
  });

  afterAll(async () => {
    await client.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('lists all four tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    expect(names).toEqual([
      'get_ports',
      'get_public_ip',
      'get_status',
      'sync_ports',
    ]);
  });

  it('calls get_status', async () => {
    const result = await client.callTool({ name: 'get_status', arguments: {} });
    expect(result.isError).toBeFalsy();
    const content = result.content as { type: string; text: string }[];
    const parsed = JSON.parse(content[0].text);
    expect(parsed.result).toBeDefined();
  });

  it('calls get_ports against mocked apis', async () => {
    const expectedGluetunPort = '12345';
    const expectedQbitTorrentPort = '54321';

    (gluetunApi.getForwardedPort as jest.Mock).mockResolvedValue({
      port: expectedGluetunPort,
    });
    (qbittorrentApi.login as jest.Mock).mockResolvedValue('token');
    (qbittorrentApi.getApplicationPreferences as jest.Mock).mockResolvedValue({
      listen_port: expectedQbitTorrentPort,
    });

    const result = await client.callTool({ name: 'get_ports', arguments: {} });
    expect(result.isError).toBeFalsy();
    const content = result.content as { type: string; text: string }[];
    const parsed = JSON.parse(content[0].text);
    expect(parsed.result.gluetunPort).toBe(expectedGluetunPort);
    expect(parsed.result.qbitTorrentPort).toBe(expectedQbitTorrentPort);
  });

  it('rejects GET with 405', async () => {
    const res = await fetch(baseUrl, { method: 'GET' });
    expect(res.status).toBe(405);
    expect(await res.json()).toMatchObject({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
    });
  });

  it('rejects DELETE with 405', async () => {
    const res = await fetch(baseUrl, { method: 'DELETE' });
    expect(res.status).toBe(405);
    expect(await res.json()).toMatchObject({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
    });
  });
});
