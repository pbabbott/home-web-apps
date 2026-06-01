import express, { type Express } from 'express';
import {
  configureBaseServerMiddleware,
  configureHealthRoute,
} from '@abbottland/express';
import { doCleanup } from './controllers/cleanup';
import { getStatus } from './controllers/status';
import { config } from './config';

export const createServer = (): Express => {
  const app = express();

  configureBaseServerMiddleware(app);
  configureHealthRoute(app);

  app.post('/cleanup', doCleanup).get('/status', getStatus);

  return app;
};

export const startServer = () => {
  const port = config.port;
  const server = createServer();
  server.listen(port, () =>
    console.log(`harbor-cleanup running on port ${port}`),
  );
};
