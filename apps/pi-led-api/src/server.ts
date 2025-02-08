import express, { type Express } from 'express';
import {
  configureBaseServerMiddleware,
  configureHealthRoute,
} from '@abbottland/express';

export const createServer = (): Express => {
  const app = express();

  configureBaseServerMiddleware(app);
  configureHealthRoute(app);

  return app;
};
export const startServer = () => {
  const port = 4001;

  const server = createServer();

  server.listen(port, () => {
    console.log(`gluetun-sync running on ${port}`);
  });
};
