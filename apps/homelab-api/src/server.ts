import express, { type Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import {
  configureBaseServerMiddleware,
  configureErrorHandler,
  configureHealthRoute,
  configureMetricsRoute,
  validateBody,
  validateParams,
  validateQuery,
} from '@abbottland/express';
import { config } from './config';
import { getMap } from './controllers/maps';
import { createHost, getHost, listHosts } from './controllers/hosts';
import { openApiSpec } from './openapi';
import { mapQuerySchema, mapTypeParamsSchema } from './schemas/maps';
import {
  createHostBodySchema,
  hostIdParamsSchema,
  hostListQuerySchema,
} from './schemas/hosts';

export const DOCS_ROUTE = '/docs';

export const createServer = (): Express => {
  const app = express();

  configureBaseServerMiddleware(app);
  configureHealthRoute(app);
  configureMetricsRoute(app);

  app.use(DOCS_ROUTE, swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.get(
    '/maps/:type',
    validateParams(mapTypeParamsSchema),
    validateQuery(mapQuerySchema),
    getMap,
  );

  app.get('/hosts', validateQuery(hostListQuerySchema), listHosts);
  app.post('/hosts', validateBody(createHostBodySchema), createHost);
  app.get('/hosts/:id', validateParams(hostIdParamsSchema), getHost);

  configureErrorHandler(app);

  return app;
};

export const startServer = () => {
  const port = config.port;

  const server = createServer();

  server.listen(port, () => {
    console.log(`homelab-api running on ${port}`);
    console.log(`📚 Swagger docs: http://localhost:${port}${DOCS_ROUTE}`);
  });
};
