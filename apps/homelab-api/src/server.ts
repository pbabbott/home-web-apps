import express, { type Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import {
  configureBaseServerMiddleware,
  configureErrorHandler,
  configureHealthRoute,
  configureMetricsRoute,
} from '@abbottland/express';
import { config } from './config';
import { openApiSpec } from './openapi';
import { createRouter, MCP_ROUTE } from './routes';

export { MCP_ROUTE };
export const DOCS_ROUTE = '/docs';
export const OPENAPI_ROUTE = '/openapi.json';

export const createServer = (): Express => {
  const app = express();

  configureBaseServerMiddleware(app);
  configureHealthRoute(app);
  configureMetricsRoute(app);

  app.get(OPENAPI_ROUTE, (_req, res) => {
    res.json(openApiSpec);
  });
  app.use(DOCS_ROUTE, swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use(createRouter());

  configureErrorHandler(app);

  return app;
};

export const startServer = () => {
  const port = config.port;

  const server = createServer();

  server.listen(port, () => {
    console.log(`homelab-api running on ${port}`);
    console.log(`📚 Swagger docs: http://localhost:${port}${DOCS_ROUTE}`);
    console.log(`📄 OpenAPI spec: http://localhost:${port}${OPENAPI_ROUTE}`);
    console.log(`🔌 MCP endpoint: http://localhost:${port}${MCP_ROUTE}`);
  });
};
