import { Request, Response } from 'express';
import { listCandidates } from '@abbottland/budget-db';
import { db } from '../db';
import type { ListCandidatesQuery } from '../schemas/filter-selections';

export const getCandidates = async (req: Request, res: Response) => {
  try {
    const { planId, unapprovedOnly, includeCovered } =
      req.query as unknown as ListCandidatesQuery;

    res.status(200).json({
      candidates: await listCandidates(db, {
        planId,
        unapprovedOnly,
        includeCovered,
      }),
    });
  } catch (err) {
    console.error('GET /candidates failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};
