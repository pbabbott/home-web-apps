import { Request, Response } from 'express';
import { listFileRenames as listFileRenamesQuery } from '@abbottland/video-db';
import { db } from '../db';
import type { ListFileRenamesQuery } from '../schemas/file-renames';

export const listFileRenames = async (req: Request, res: Response) => {
  // req.query is already validated/typed by the validateQuery(listFileRenamesQuerySchema) middleware.
  const { status } = req.query as ListFileRenamesQuery;

  try {
    const fileRenames = await listFileRenamesQuery(db, { status });

    res.status(200).json({ fileRenames });
  } catch (err) {
    console.error('GET /file-renames failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};
