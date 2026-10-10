import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { type Express, type Request, type Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import {
  configureBaseServerMiddleware,
  configureHealthRoute,
  configureMetricsRoute,
} from '@abbottland/express';
import { config } from './config';
import { getPorts } from './controllers/get-ports';
import { getPublicIp } from './controllers/get-public-ip';
import { getStatus } from './controllers/get-status';
import { doSync } from './controllers/sync-ports';
import { createMcpServer } from './mcp';
import { openApiSpec } from './openapi';

export const DOCS_ROUTE = '/docs';
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

// Stateless MCP handler: no session store, so a fresh McpServer + transport
// is created per request. This fits a horizontally-scaled k8s deployment with
// no sticky sessions. GET/DELETE are rejected outright rather than left to the
// transport — a standalone GET SSE stream has nothing to push in stateless
// mode, and DELETE's session-close semantics don't apply when nothing persists
// across requests.
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

export const createServer = (): Express => {
  const app = express();

  configureBaseServerMiddleware(app);
  configureHealthRoute(app);
  configureMetricsRoute(app);

  app.use(DOCS_ROUTE, swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app
    .post('/sync', doSync)
    .get('/status', getStatus)
    .get('/status/public-ip', getPublicIp)
    .get('/status/ports', getPorts);

  app
    .post(MCP_ROUTE, handleMcpRequest)
    .get(MCP_ROUTE, methodNotAllowed)
    .delete(MCP_ROUTE, methodNotAllowed);

  return app;
};

export const startServer = () => {
  const port = config.port;

  const server = createServer();

  server.listen(port, () => {
    console.log(`gluetun-sync running on ${port}`);
    console.log(`📚 Swagger docs: http://localhost:${port}${DOCS_ROUTE}`);
    console.log(`🔌 MCP endpoint: http://localhost:${port}${MCP_ROUTE}`);
  });
};
