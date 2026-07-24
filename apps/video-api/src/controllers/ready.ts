import { Request, Response } from 'express';
import { pingDb } from '@abbottland/video-db';
import { db } from '../db';

export const getReady = async (_req: Request, res: Response) => {
  try {
    await pingDb(db);

    res.status(200).json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', message: 'database unreachable' });
  }
};
