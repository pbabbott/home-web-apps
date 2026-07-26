import express, { type Express } from 'express';
import {
  configureBaseServerMiddleware,
  configureHealthRoute,
  configureMetricsRoute,
} from '@abbottland/express';
import { config } from './config';
import { doSync } from './controllers/sync';
import { getPorts, getPublicIp, getStatus } from './controllers/status';

export const createServer = (): Express => {
  const app = express();

  configureBaseServerMiddleware(app);
  configureHealthRoute(app);
  configureMetricsRoute(app);

  app
    .post('/sync', doSync)
    .get('/status', getStatus)
    .get('/status/public-ip', getPublicIp)
    .get('/status/ports', getPorts);

  return app;
};

export const startServer = () => {
  const port = config.port;

  const server = createServer();

  server.listen(port, () => {
    console.log(`gluetun-sync running on ${port}`);
  });
};
