import { Express } from 'express';
import { configureVersionRoute } from '../version-route/version-route';

export const configureHealthRoute = (app: Express) => {
  app.get('/healthz', (_, res) => {
    return res.json({ status: 'ok' });
  });

  // Also registers /version. The /healthz body above is deliberately unchanged:
  // probes and tests depend on it.
  configureVersionRoute(app);
};
