import express, { type Express } from 'express';
import {
  configureBaseServerMiddleware,
  configureErrorHandler,
  configureHealthRoute,
} from '@abbottland/express';
import { config } from './config';
import { getReady } from './controllers/ready';

export const createServer = (): Express => {
  const app = express();

  configureBaseServerMiddleware(app);
  configureHealthRoute(app);

  app.get('/readyz', getReady);

  configureErrorHandler(app);

  return app;
};

export const startServer = () => {
  const port = config.port;

  const server = createServer();

  server.listen(port, () => {
    console.log(`video-worker running on ${port}`);
  });
};
