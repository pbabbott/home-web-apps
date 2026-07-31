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
import { getAiStatusRoute } from './controllers/ai';
import {
  deleteFileRename,
  deleteFileRenames,
  listFileRenames,
} from './controllers/file-renames';
import { getJob, listJobs, postJob } from './controllers/jobs';
import { getReady } from './controllers/ready';
import { deleteTitleCard, listTitleCards } from './controllers/title-cards';
import { openApiSpec } from './openapi';
import {
  deleteFileRenamesQuerySchema,
  fileRenameIdParamsSchema,
  listFileRenamesQuerySchema,
} from './schemas/file-renames';
import {
  createJobSchema,
  jobIdParamsSchema,
  listJobsQuerySchema,
} from './schemas/jobs';
import {
  listTitleCardsQuerySchema,
  titleCardIdParamsSchema,
} from './schemas/title-cards';

export const DOCS_ROUTE = '/docs';

export const createServer = (): Express => {
  const app = express();

  configureBaseServerMiddleware(app);
  configureHealthRoute(app);
  configureMetricsRoute(app);

  app.use(DOCS_ROUTE, swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app
    .get('/readyz', getReady)
    .get('/ai/status', getAiStatusRoute)
    .post('/jobs', validateBody(createJobSchema), postJob)
    .get('/jobs', validateQuery(listJobsQuerySchema), listJobs)
    .get('/jobs/:id', validateParams(jobIdParamsSchema), getJob)
    .get(
      '/title-cards',
      validateQuery(listTitleCardsQuerySchema),
      listTitleCards,
    )
    .delete(
      '/title-cards/:id',
      validateParams(titleCardIdParamsSchema),
      deleteTitleCard,
    )
    .get(
      '/file-renames',
      validateQuery(listFileRenamesQuerySchema),
      listFileRenames,
    )
    .delete(
      '/file-renames',
      validateQuery(deleteFileRenamesQuerySchema),
      deleteFileRenames,
    )
    .delete(
      '/file-renames/:id',
      validateParams(fileRenameIdParamsSchema),
      deleteFileRename,
    );

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
