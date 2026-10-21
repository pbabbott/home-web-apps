import {
  getMcpServerInfo,
  getRestOperations,
  type McpServerInfo,
  type RestOperation,
} from '../sources/lib/homelab-api';
import { HOMELAB_API_PUBLIC_URL } from '../sources/lib/homelab-api/config';
import { ArchitectureClient } from './ArchitectureClient';

// Always rendered per request: the tool and route lists come from the running
// homelab-api and must not be frozen at build time.
export const dynamic = 'force-dynamic';

export default async function ExodusArchitecturePage() {
  const [mcpResult, restResult] = await Promise.allSettled([
    getMcpServerInfo(),
    getRestOperations(),
  ]);

  let mcp: McpServerInfo | null = null;
  let operations: RestOperation[] | null = null;

  if (mcpResult.status === 'fulfilled') {
    mcp = mcpResult.value;
  } else {
    console.error(
      'Failed to load MCP tools from homelab-api:',
      mcpResult.reason,
    );
  }

  if (restResult.status === 'fulfilled') {
    operations = restResult.value;
  } else {
    console.error(
      'Failed to load the OpenAPI spec from homelab-api:',
      restResult.reason,
    );
  }

  return (
    <ArchitectureClient
      mcp={mcp}
      operations={operations}
      swaggerUrl={`${HOMELAB_API_PUBLIC_URL}/docs`}
    />
  );
}
