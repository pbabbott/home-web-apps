import { Express, Request } from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { json, urlencoded } from 'body-parser';

/** Polled on an interval by k8s probes/Prometheus, not real traffic — logging them just buries everything else. */
const UNLOGGED_PATHS = new Set(['/readyz', '/healthz', '/metrics']);

export const configureBaseServerMiddleware = (app: Express) => {
  app
    .disable('x-powered-by')
    .use(
      morgan('dev', {
        skip: (req: Request) => UNLOGGED_PATHS.has(req.path),
      }),
    )
    .use(urlencoded({ extended: true }))
    .use(json())
    .use(cors());
};
