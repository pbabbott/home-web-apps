import { Request, Response } from 'express';
import {
  deleteTitleCardById,
  listTitleCards as listTitleCardsQuery,
} from '@abbottland/video-db';
import { db } from '../db';
import type { ListTitleCardsQuery } from '../schemas/title-cards';

export const listTitleCards = async (req: Request, res: Response) => {
  // req.query is already validated/typed by the validateQuery(listTitleCardsQuerySchema) middleware.
  const { fileHash, season } = req.query as ListTitleCardsQuery;

  try {
    const titleCards = await listTitleCardsQuery(db, { fileHash, season });

    res.status(200).json({ titleCards });
  } catch (err) {
    console.error('GET /title-cards failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const deleteTitleCard = async (req: Request, res: Response) => {
  // req.params is already validated/typed by the validateParams(titleCardIdParamsSchema) middleware.
  try {
    const titleCard = await deleteTitleCardById(db, req.params.id);

    if (!titleCard) {
      return res.status(404).json({ message: 'title card not found' });
    }

    res.status(200).json(titleCard);
  } catch (err) {
    console.error(`DELETE /title-cards/${req.params.id} failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};
