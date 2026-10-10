import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getForwardedPort } from './api/gluetun/gluetun';
import { getApplicationPreferences, login } from './api/qbittorrent';
import { getPortsOperation } from './controllers/get-ports';
import { getPublicIpOperation } from './controllers/get-public-ip';
import { getStatusOperation } from './controllers/get-status';
import { doSyncOperation } from './controllers/sync-ports';
import { getStatusRecord, SyncCaller } from './data';
import { showPublicIp } from './services/publicIpService';
import { syncPorts } from './services/syncService';

const textResult = (value: unknown, isError = false) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  isError,
});

// Tool descriptions are built from the same *Operation metadata the OpenAPI
// spec uses (src/controllers/*.ts) rather than authored again here, so they
// can't drift from either the controllers or the Swagger docs.
const toolDescription = (operation: {
  summary: string;
  description?: string;
}) =>
  operation.description
    ? `${operation.summary}. ${operation.description}`
    : `${operation.summary}.`;

/**
 * Builds a fresh MCP server exposing the same operations as the REST routes
 * in server.ts. A new instance is created per-request (see server.ts) since
 * the Streamable HTTP transport is mounted in stateless mode.
 */
export const createMcpServer = (): McpServer => {
  const server = new McpServer({ name: 'gluetun-sync', version: '0.1.1' });

  server.registerTool(
    'sync_ports',
    {
      description: toolDescription(doSyncOperation),
    },
    async () => {
      const result = await syncPorts(SyncCaller.MCP);
      return textResult(result, !result.success);
    },
  );

  server.registerTool(
    'get_status',
    {
      description: toolDescription(getStatusOperation),
    },
    async () => textResult({ result: getStatusRecord() }),
  );

  server.registerTool(
    'get_ports',
    {
      description: toolDescription(getPortsOperation),
    },
    async () => {
      const gluetunPort = await getForwardedPort();
      const qbitTorrentLoginResult = await login();
      let qbitTorrentPort = null;
      if (qbitTorrentLoginResult !== null) {
        const preferences = await getApplicationPreferences(
          qbitTorrentLoginResult,
        );
        qbitTorrentPort = preferences?.listen_port.toString();
      }

      return textResult({
        result: {
          gluetunPort: gluetunPort?.port.toString(),
          qbitTorrentPort,
        },
      });
    },
  );

  server.registerTool(
    'get_public_ip',
    {
      description: toolDescription(getPublicIpOperation),
    },
    async () => {
      const publicIP = await showPublicIp();
      if (publicIP === null)
        return textResult({ message: 'Could not get public IP' }, true);
      return textResult({ result: publicIP });
    },
  );

  return server;
};
