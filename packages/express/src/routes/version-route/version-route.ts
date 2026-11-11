import { Express } from 'express';

/**
 * GET /version reports the image tag this pod runs (IMAGE_TAG, set by Flux from
 * the image's tag in home-kubernetes), and logs it once at startup so it is
 * visible in `kubectl logs`. The env is read per request, not captured at startup.
 */
export const configureVersionRoute = (app: Express) => {
  console.log(`[version] image tag: ${process.env['IMAGE_TAG'] ?? 'dev'}`);

  app.get('/version', (_, res) => {
    res.set('Cache-Control', 'no-store');
    return res.json({ tag: process.env['IMAGE_TAG'] ?? 'dev' });
  });
};
