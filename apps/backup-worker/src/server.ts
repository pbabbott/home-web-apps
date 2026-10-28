import express, { type Express } from 'express';
import {
  configureBaseServerMiddleware,
  configureErrorHandler,
  configureMetricsRoute,
} from '@abbottland/express';
import { config } from './config';
import { getHealth } from './controllers/health';
import { getReady } from './controllers/ready';

export const createServer = (): Express => {
  const app = express();

  configureBaseServerMiddleware(app);
  configureMetricsRoute(app);

  app.get('/healthz', getHealth);
  app.get('/readyz', getReady);

  configureErrorHandler(app);

  return app;
};

export const startServer = () => {
  const port = config.port;

  const server = createServer();

  server.listen(port, () => {
    console.log(`backup-worker running on ${port}`);
  });
};
