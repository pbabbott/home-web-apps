import { Request, Response } from 'express';
import { hasAppliedLatestMigration, pingDb } from '@abbottland/homelab-db';
import { db } from '../db';
import { getWatchdog } from '../destination/runtime';

export const getReady = async (_req: Request, res: Response) => {
  const destination = getWatchdog().state();

  if (destination.stalled) {
    console.error(
      `GET /readyz failed - destination call stalled: ${destination.operation}`,
    );
    return res.status(503).json({
      status: 'error',
      message: `destination call stalled: ${destination.operation}`,
    });
  }

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
