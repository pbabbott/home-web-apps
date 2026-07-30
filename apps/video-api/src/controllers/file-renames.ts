import { Request, Response } from 'express';
import {
  deleteFileRenamesBySeason,
  listFileRenames as listFileRenamesQuery,
} from '@abbottland/video-db';
import { db } from '../db';
import type {
  DeleteFileRenamesQuery,
  ListFileRenamesQuery,
} from '../schemas/file-renames';

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

export const deleteFileRenames = async (req: Request, res: Response) => {
  // req.query is already validated/typed by the validateQuery(deleteFileRenamesQuerySchema) middleware.
  const { season } = req.query as unknown as DeleteFileRenamesQuery;

  try {
    const deleted = await deleteFileRenamesBySeason(db, season);

    res.status(200).json({ deletedCount: deleted.length });
  } catch (err) {
    console.error('DELETE /file-renames failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};
