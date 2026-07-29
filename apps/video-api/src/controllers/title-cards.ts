import { Request, Response } from 'express';
import { listTitleCards as listTitleCardsQuery } from '@abbottland/video-db';
import { db } from '../db';
import type { ListTitleCardsQuery } from '../schemas/title-cards';

export const listTitleCards = async (req: Request, res: Response) => {
  // req.query is already validated/typed by the validateQuery(listTitleCardsQuerySchema) middleware.
  const { fileHash } = req.query as ListTitleCardsQuery;

  try {
    const titleCards = await listTitleCardsQuery(db, { fileHash });

    res.status(200).json({ titleCards });
  } catch (err) {
    console.error('GET /title-cards failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};
