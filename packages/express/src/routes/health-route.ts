import { Router } from 'express';
export const configureHealthRoute = (router: Router) => {
  router.get('/healthz', (_, res) => {
    return res.json({ ok: true });
  });
};
