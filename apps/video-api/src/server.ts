import express, { type Express } from 'express';
import {
  configureBaseServerMiddleware,
  configureHealthRoute,
} from '@abbottland/express';
import { config } from './config';
import { browseDirectory } from './controllers/browse';
import { getJob, postJob } from './controllers/jobs';
import { getReady } from './controllers/ready';

export const createServer = (): Express => {
  const app = express();

  configureBaseServerMiddleware(app);
  configureHealthRoute(app);

  app
    .get('/readyz', getReady)
    .post('/jobs', postJob)
    .get('/jobs/:id', getJob)
    .get('/browse', browseDirectory);

  return app;
};

export const startServer = () => {
  const port = config.port;

  const server = createServer();

  server.listen(port, () => {
    console.log(`video-api running on ${port}`);
  });
};
