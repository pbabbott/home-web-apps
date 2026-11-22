import { Request, Response } from 'express';
import {
  listYnabPlans,
  listYnabRawResponseSummaries,
  listYnabSyncRuns,
  listYnabSyncState,
} from '@abbottland/budget-db';
import { db } from '../db';
import type { ListRawResponsesQuery } from '../schemas/jobs';

export const listSyncState = async (_req: Request, res: Response) => {
  try {
    const syncState = await listYnabSyncState(db);

    res.status(200).json({ syncState });
  } catch (err) {
    console.error('GET /ynab/sync-state failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const listRawResponses = async (req: Request, res: Response) => {
  // Validated/typed by validateQuery(listRawResponsesQuerySchema).
  const { planId, endpoint, limit } = req.query as ListRawResponsesQuery;

  try {
    const rawResponses = await listYnabRawResponseSummaries(db, {
      planId,
      endpoint,
      limit,
    });

    res.status(200).json({ rawResponses });
  } catch (err) {
    console.error('GET /ynab/raw-responses failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const listPlans = async (_req: Request, res: Response) => {
  try {
    res.status(200).json({ plans: await listYnabPlans(db) });
  } catch (err) {
    console.error('GET /ynab/plans failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const listSyncRuns = async (_req: Request, res: Response) => {
  try {
    res.status(200).json({ syncRuns: await listYnabSyncRuns(db) });
  } catch (err) {
    console.error('GET /ynab/sync-runs failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};
