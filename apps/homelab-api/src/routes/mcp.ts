import { Router, type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from '../mcp';

export const MCP_ROUTE = '/mcp';

// Mirrors the JSON-RPC error shape the MCP SDK itself returns for
// unsupported methods (see StreamableHTTPServerTransport#handleUnsupportedRequest).
const methodNotAllowed = (_req: Request, res: Response) => {
  res.set('Allow', 'POST');
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  });
};

// Stateless MCP handler: a fresh McpServer + transport per request, no session
// store, so it works across replicas without sticky sessions. GET/DELETE are
// rejected since there is no session to stream to or close.
const handleMcpRequest = async (req: Request, res: Response) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on('close', () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
};

export const mcpRouter = Router();

mcpRouter
  .post(MCP_ROUTE, handleMcpRequest)
  .get(MCP_ROUTE, methodNotAllowed)
  .delete(MCP_ROUTE, methodNotAllowed);
