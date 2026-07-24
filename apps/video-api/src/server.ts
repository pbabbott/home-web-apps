import express, { type Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import {
  configureBaseServerMiddleware,
  configureErrorHandler,
  configureHealthRoute,
  validateBody,
  validateParams,
  validateQuery,
} from '@abbottland/express';
import { config } from './config';
import { browseDirectory } from './controllers/browse';
import { getJob, listJobs, postJob } from './controllers/jobs';
import { getReady } from './controllers/ready';
import { openApiSpec } from './openapi';
import {
  createJobSchema,
  jobIdParamsSchema,
  listJobsQuerySchema,
} from './schemas/jobs';
import { browseQuerySchema } from './schemas/browse';

export const DOCS_ROUTE = '/docs';

export const createServer = (): Express => {
  const app = express();

  configureBaseServerMiddleware(app);
  configureHealthRoute(app);

  app.use(DOCS_ROUTE, swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app
    .get('/readyz', getReady)
    .post('/jobs', validateBody(createJobSchema), postJob)
    .get('/jobs', validateQuery(listJobsQuerySchema), listJobs)
    .get('/jobs/:id', validateParams(jobIdParamsSchema), getJob)
    .get('/browse', validateQuery(browseQuerySchema), browseDirectory);

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
