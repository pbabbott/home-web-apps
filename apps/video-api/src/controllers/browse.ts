import fs from 'fs/promises';
import { Request, Response } from 'express';
import { config } from '../config';
import { resolveWithinRoot } from '../lib/safe-path';
import type { BrowseQuery } from '../schemas/browse';

type BrowseEntry = {
  name: string;
  type: 'directory' | 'file';
};

export const browseDirectory = async (req: Request, res: Response) => {
  // req.query is already validated/typed by the validateQuery(browseQuerySchema) middleware.
  const { path: requestedPath } = req.query as BrowseQuery;

  const targetPath = resolveWithinRoot(config.mediaRoot, requestedPath ?? '');

  if (!targetPath) {
    return res
      .status(400)
      .json({ message: 'path is outside the configured media root' });
  }

  try {
    const stat = await fs.stat(targetPath);

    if (!stat.isDirectory()) {
      return res.status(400).json({ message: 'path is not a directory' });
    }

    const dirents = await fs.readdir(targetPath, { withFileTypes: true });

    const entries: BrowseEntry[] = dirents
      .map((dirent) => ({
        name: dirent.name,
        type: dirent.isDirectory() ? ('directory' as const) : ('file' as const),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.status(200).json({ path: requestedPath ?? '/', entries });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return res.status(404).json({ message: 'path not found' });
    }

    console.error(`GET /browse?path=${requestedPath ?? ''} failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};
