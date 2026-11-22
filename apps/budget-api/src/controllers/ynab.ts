import { Request, Response } from 'express';
import { listYnabSyncState } from '@abbottland/budget-db';
import { db } from '../db';

export const listSyncState = async (_req: Request, res: Response) => {
  try {
    const syncState = await listYnabSyncState(db);

    res.status(200).json({ syncState });
  } catch (err) {
    console.error('GET /ynab/sync-state failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};
