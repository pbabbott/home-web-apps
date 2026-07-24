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
import {
  getFileRename,
  listFileRenamesHandler,
  patchFileRenameStatus,
  postFileRename,
} from './controllers/file-renames';
import { getHash } from './controllers/hash';
import { getJob, listJobs, postJob } from './controllers/jobs';
import { getReady } from './controllers/ready';
import {
  getTitleCard,
  listTitleCardsHandler,
  postTitleCard,
} from './controllers/title-cards';
import { openApiSpec } from './openapi';
import {
  createJobSchema,
  jobIdParamsSchema,
  listJobsQuerySchema,
} from './schemas/jobs';
import { browseQuerySchema } from './schemas/browse';
import { hashQuerySchema } from './schemas/hash';
import {
  createTitleCardSchema,
  listTitleCardsQuerySchema,
  titleCardIdParamsSchema,
} from './schemas/title-cards';
import {
  createFileRenameSchema,
  fileRenameIdParamsSchema,
  listFileRenamesQuerySchema,
  updateFileRenameStatusSchema,
} from './schemas/file-renames';

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
    .get('/browse', validateQuery(browseQuerySchema), browseDirectory)
    .get('/hash', validateQuery(hashQuerySchema), getHash)
    .post('/title-cards', validateBody(createTitleCardSchema), postTitleCard)
    .get(
      '/title-cards',
      validateQuery(listTitleCardsQuerySchema),
      listTitleCardsHandler,
    )
    .get(
      '/title-cards/:id',
      validateParams(titleCardIdParamsSchema),
      getTitleCard,
    )
    .post('/file-renames', validateBody(createFileRenameSchema), postFileRename)
    .get(
      '/file-renames',
      validateQuery(listFileRenamesQuerySchema),
      listFileRenamesHandler,
    )
    .get(
      '/file-renames/:id',
      validateParams(fileRenameIdParamsSchema),
      getFileRename,
    )
    .patch(
      '/file-renames/:id',
      validateParams(fileRenameIdParamsSchema),
      validateBody(updateFileRenameStatusSchema),
      patchFileRenameStatus,
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
