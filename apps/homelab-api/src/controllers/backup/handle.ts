import { Request, RequestHandler, Response } from 'express';
import { BackupError } from '../../services/backup';
import { HttpError } from '../../lib/http-error';

/**
 * Wraps a handler so a BackupError becomes 404/409 (with any structured
 * details merged into the body), an HttpError keeps its own status, and
 * anything else is logged and returned as a generic 500.
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
      if (err instanceof BackupError) {
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
