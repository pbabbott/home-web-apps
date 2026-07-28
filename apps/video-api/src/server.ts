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
import { getJob, listJobs, postJob } from './controllers/jobs';
import { getReady } from './controllers/ready';
import { openApiSpec } from './openapi';
import {
  createJobSchema,
  jobIdParamsSchema,
  listJobsQuerySchema,
} from './schemas/jobs';

export const DOCS_ROUTE = '/docs';

export const createServer = (): Express => {
  const app = express();

  configureBaseServerMiddleware(app);
  configureHealthRoute(app);
  configureMetricsRoute(app);

  app.use(DOCS_ROUTE, swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app
    .get('/readyz', getReady)
    .post('/jobs', validateBody(createJobSchema), postJob)
    .get('/jobs', validateQuery(listJobsQuerySchema), listJobs)
    .get('/jobs/:id', validateParams(jobIdParamsSchema), getJob);

  configureErrorHandler(app);

  return app;
};

export const startServer = () => {
  const port = config.port;

  const server = createServer();

  server.listen(port, () => {
    console.log(`video-api running on ${port}`);
    console.log(`📚 Swagger docs: http://localhost:${port}${DOCS_ROUTE}`);
  });
};
