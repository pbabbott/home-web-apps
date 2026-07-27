import { Request, Response } from 'express';
import { resolveFilePath } from '../lib/resolve-file-path';
import { getRuntimeSeconds } from '../lib/get-runtime';
import type { RunTimeQuery } from '../schemas/run-time';

export const getRunTime = async (req: Request, res: Response) => {
  // req.query is already validated/typed by the validateQuery(runTimeQuerySchema) middleware.
  const { filePath } = req.query as RunTimeQuery;

  try {
    const resolved = resolveFilePath(filePath);
    if (resolved.ok === false) {
      return res.status(resolved.status).json({ message: resolved.message });
    }

    const runTimeSeconds = await getRuntimeSeconds(resolved.absPath);

    res.status(200).json({ filePath, runTimeSeconds });
  } catch (err) {
    console.error('GET /run-time failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};
