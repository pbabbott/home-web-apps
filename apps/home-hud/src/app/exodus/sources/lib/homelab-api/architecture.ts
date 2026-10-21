import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { HOMELAB_API_URL } from './config';
import { getJson } from './http';

export type McpTool = { name: string; description: string };

export type McpServerInfo = {
  instructions: string | null;
  tools: McpTool[];
};

export type RestOperation = {
  method: string;
  path: string;
  summary: string;
  /** The operation's domain, the same group Swagger UI shows it under. */
  tag: string | null;
  /** Set when the agent can do the same thing through an MCP tool. */
  mcpTool: string | null;
  /** home-hud page that calls the route; null when only Swagger/curl does. */
  hudPage: string | null;
};

type OpenApiDoc = {
  paths: Record<
    string,
    Record<
      string,
      {
        summary?: string;
        'x-mcp-tool'?: string;
        'x-home-hud'?: string;
        tags?: string[];
      }
    >
  >;
};

/** The page font renders curly apostrophes poorly; the API text uses them. */
const straighten = (text: string): string => text.replaceAll('’', "'");

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

export async function getMcpServerInfo(): Promise<McpServerInfo> {
  const client = new Client({ name: 'home-hud', version: '0.1.0' });

  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', HOMELAB_API_URL)),
    );

    const { tools } = await client.listTools();

    return {
      instructions: straighten(client.getInstructions() ?? '') || null,
      tools: tools.map(({ name, description }) => ({
        name,
        description: straighten(description ?? ''),
      })),
    };
  } finally {
    await client.close();
  }
}

export async function getRestOperations(): Promise<RestOperation[]> {
  const { paths } = await getJson<OpenApiDoc>('/openapi.json');

  return Object.entries(paths).flatMap(([path, operations]) =>
    Object.entries(operations)
      .filter(([method]) => HTTP_METHODS.includes(method))
      .map(([method, operation]) => ({
        method: method.toUpperCase(),
        path,
        summary: straighten(operation.summary ?? ''),
        mcpTool: operation['x-mcp-tool'] ?? null,
        tag: operation.tags?.[0] ?? null,
        hudPage: operation['x-home-hud'] ?? null,
      })),
  );
}
