import { Request, Response } from 'express';
import { resolveAndHashPath } from '../lib/resolve-and-hash-path';
import type { HashQuery } from '../schemas/hash';

export const getHash = async (req: Request, res: Response) => {
  // req.query is already validated/typed by the validateQuery(hashQuerySchema) middleware.
  const { filePath } = req.query as HashQuery;

  try {
    const result = await resolveAndHashPath(filePath);
    if (result.ok === false) {
      return res.status(result.status).json({ message: result.message });
    }

    res.status(200).json({ filePath, fileHash: result.hash });
  } catch (err) {
    console.error('GET /hash failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};
