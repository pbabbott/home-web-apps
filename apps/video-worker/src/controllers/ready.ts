import { Request, Response } from 'express';
import { hasAppliedLatestMigration, pingDb } from '@abbottland/video-db';
import { db } from '../db';

export const getReady = async (_req: Request, res: Response) => {
  try {
    await pingDb(db);
  } catch (err) {
    console.error('GET /readyz failed - database unreachable:', err);
    return res
      .status(503)
      .json({ status: 'error', message: 'database unreachable' });
  }

  try {
    const upToDate = await hasAppliedLatestMigration(db);

    if (!upToDate) {
      console.error('GET /readyz failed - database schema is out of date');
      return res
        .status(503)
        .json({ status: 'error', message: 'database schema is out of date' });
    }
  } catch (err) {
    console.error(
      'GET /readyz failed - could not verify database schema:',
      err,
    );
    return res
      .status(503)
      .json({ status: 'error', message: 'could not verify database schema' });
  }

  res.status(200).json({ status: 'ok' });
};
