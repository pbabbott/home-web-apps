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
import { getCandidates } from './controllers/candidates';
import {
  getReference,
  getSelection,
  listAudit,
  listSelections,
  postPreview,
  postSelection,
  putSelection,
  removeSelection,
} from './controllers/filter-selections';
import { getJob, listJobs, postJob } from './controllers/jobs';
import { getReady } from './controllers/ready';
import {
  listPlans,
  listRawResponses,
  listSyncRuns,
  listSyncState,
} from './controllers/ynab';
import { openApiSpec } from './openapi';
import {
  filterSelectionBodySchema,
  filterSelectionIdParamsSchema,
  listAuditQuerySchema,
  listCandidatesQuerySchema,
  previewBodySchema,
  referenceQuerySchema,
} from './schemas/filter-selections';
import {
  createJobSchema,
  jobIdParamsSchema,
  listJobsQuerySchema,
  listRawResponsesQuerySchema,
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
    .get('/jobs/:id', validateParams(jobIdParamsSchema), getJob)
    .get('/filter-selections', listSelections)
    .post(
      '/filter-selections',
      validateBody(filterSelectionBodySchema),
      postSelection,
    )
    .post(
      '/filter-selections/preview',
      validateBody(previewBodySchema),
      postPreview,
    )
    .get(
      '/filter-selections/audit',
      validateQuery(listAuditQuerySchema),
      listAudit,
    )
    .get(
      '/filter-selections/:id',
      validateParams(filterSelectionIdParamsSchema),
      getSelection,
    )
    .put(
      '/filter-selections/:id',
      validateParams(filterSelectionIdParamsSchema),
      validateBody(filterSelectionBodySchema),
      putSelection,
    )
    .delete(
      '/filter-selections/:id',
      validateParams(filterSelectionIdParamsSchema),
      removeSelection,
    )
    .get('/candidates', validateQuery(listCandidatesQuerySchema), getCandidates)
    .get('/ynab/reference', validateQuery(referenceQuerySchema), getReference)
    .get('/ynab/plans', listPlans)
    .get('/ynab/sync-runs', listSyncRuns)
    .get('/ynab/sync-state', listSyncState)
    .get(
      '/ynab/raw-responses',
      validateQuery(listRawResponsesQuerySchema),
      listRawResponses,
    );

  configureErrorHandler(app);

  return app;
};

export const startServer = () => {
  const port = config.port;

  const server = createServer();

  server.listen(port, () => {
    console.log(`budget-api running on ${port}`);
    console.log(`📚 Swagger docs: http://localhost:${port}${DOCS_ROUTE}`);
  });
};
