import { Request, Response } from 'express';
import {
  getTitleCardById,
  listTitleCards,
  upsertTitleCard,
} from '@abbottland/video-db';
import { db } from '../db';
import { resolveAndHashPath } from '../lib/resolve-and-hash-path';
import type {
  CreateTitleCardBody,
  ListTitleCardsQuery,
} from '../schemas/title-cards';

export const postTitleCard = async (req: Request, res: Response) => {
  // req.body is already validated/typed by the validateBody(createTitleCardSchema) middleware.
  const { filePath, timestampSeconds, title, screenshotPath } =
    req.body as CreateTitleCardBody;

  try {
    const result = await resolveAndHashPath(filePath);
    if (result.ok === false) {
      return res.status(result.status).json({ message: result.message });
    }

    const titleCard = await upsertTitleCard(db, {
      fileHash: result.hash,
      filePath,
      timestampSeconds,
      title,
      screenshotPath,
    });

    res.status(201).json(titleCard);
  } catch (err) {
    console.error('POST /title-cards failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const getTitleCard = async (req: Request, res: Response) => {
  try {
    const titleCard = await getTitleCardById(db, req.params.id);

    if (!titleCard)
      return res.status(404).json({ message: 'title card not found' });

    res.status(200).json(titleCard);
  } catch (err) {
    console.error(`GET /title-cards/${req.params.id} failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const listTitleCardsHandler = async (req: Request, res: Response) => {
  // req.query is already validated/typed by the validateQuery(listTitleCardsQuerySchema) middleware.
  const { fileHash: queryFileHash, filePath } =
    req.query as ListTitleCardsQuery;

  try {
    let fileHash = queryFileHash;

    if (!fileHash && filePath) {
      const result = await resolveAndHashPath(filePath);
      if (result.ok === false) {
        return res.status(result.status).json({ message: result.message });
      }
      fileHash = result.hash;
    }

    const titleCards = await listTitleCards(db, { fileHash });

    res.status(200).json({ titleCards });
  } catch (err) {
    console.error('GET /title-cards failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};
