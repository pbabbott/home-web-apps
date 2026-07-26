import { Express, NextFunction, Request, Response } from 'express';

/**
 * Catch-all Express error middleware. Register this LAST, after all routes,
 * so it catches anything an app's own route handlers didn't already handle
 * (including rejected promises from async handlers, which Express 5
 * forwards here automatically). Always logs the full error server-side so
 * failures are never silently swallowed.
 */
export const configureErrorHandler = (app: Express) => {
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);

    console.error(`❌ ${req.method} ${req.originalUrl} failed:`, err);

    res.status(500).json({ message: 'Internal Server Error' });
  });
};
