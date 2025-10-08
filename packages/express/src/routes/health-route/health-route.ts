import { Express } from 'express';

export const configureHealthRoute = (app: Express) => {
  app.get('/healthz', (_, res) => {
    return res.json({ status: 'ok' });
  });
};
