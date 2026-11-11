import express, { type Express } from 'express';
import {
  configureBaseServerMiddleware,
  configureErrorHandler,
  configureMetricsRoute,
  configureVersionRoute,
} from '@abbottland/express';
import { config } from './config';
import { getHealth } from './controllers/health';
import { getReady } from './controllers/ready';
import type { DestinationWatchdog } from './destination/watchdog';

export const createServer = (watchdog: DestinationWatchdog): Express => {
  const app = express();

  configureBaseServerMiddleware(app);
  configureMetricsRoute(app);
  configureVersionRoute(app);

  app.get('/healthz', getHealth(watchdog));
  app.get('/readyz', getReady(watchdog));

  configureErrorHandler(app);

  return app;
};

export const startServer = (watchdog: DestinationWatchdog) => {
  const port = config.port;

  const server = createServer(watchdog);

  server.listen(port, () => {
    console.log(`backup-worker running on ${port}`);
  });
};
