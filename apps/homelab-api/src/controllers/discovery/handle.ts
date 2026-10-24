import { Request, RequestHandler, Response } from 'express';
import { HttpError } from '../../lib/http-error';
import { DiscoveryError } from '../../services/discovery';

/**
 * Wraps a handler so a DiscoveryError becomes 404/409 (with any structured
 * details, e.g. queueCounts, merged into the body), an HttpError keeps its
 * own status, and anything else is
 * logged and returned as a generic 500, like the hand-written try/catch in
 * the other controllers.
 */
export const handle =
  (
    label: string,
    fn: (req: Request, res: Response) => Promise<void>,
  ): RequestHandler =>
  async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof DiscoveryError) {
        res
          .status(err.code === 'not_found' ? 404 : 409)
          .json({ message: err.message, ...err.details });
        return;
      }

      if (err instanceof HttpError) {
        res.status(err.status).json({ message: err.message });
        return;
      }

      console.error(`${label} failed:`, err);
      res.status(500).json({ message: 'internal server error' });
    }
  };
