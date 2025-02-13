import express, { type Express } from 'express';
import {
  configureBaseServerMiddleware,
  configureHealthRoute,
} from '@abbottland/express';
import { getStatus } from './controllers/status';
import { postColor } from './controllers/color';

export const createServer = (): Express => {
  const app = express();

  configureBaseServerMiddleware(app);
  configureHealthRoute(app);

  app.get('/status', getStatus);
  app.post('/color', postColor);

  return app;
};
export const startServer = () => {
  const port = 4001;

  const server = createServer();

  server.listen(port, () => {
    console.log(`pi-led-api running on port: ${port}`);
  });
};
