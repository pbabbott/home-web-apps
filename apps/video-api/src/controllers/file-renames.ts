import { Request, Response } from 'express';
import {
  getFileRenameById,
  listFileRenames,
  updateFileRenameStatus,
  upsertFileRename,
} from '@abbottland/video-db';
import { db } from '../db';
import { config } from '../config';
import { resolveWithinRoot } from '../lib/safe-path';
import { resolveAndHashPath } from '../lib/resolve-and-hash-path';
import type {
  CreateFileRenameBody,
  ListFileRenamesQuery,
  UpdateFileRenameStatusBody,
} from '../schemas/file-renames';

export const postFileRename = async (req: Request, res: Response) => {
  // req.body is already validated/typed by the validateBody(createFileRenameSchema) middleware.
  const { originalFilePath, suggestedFilePath } =
    req.body as CreateFileRenameBody;

  // suggestedFilePath doesn't exist yet (nothing renames the file
  // automatically) so it's only checked for path traversal, not existence.
  if (!resolveWithinRoot(config.mediaRoot, suggestedFilePath)) {
    return res.status(400).json({
      message: 'suggestedFilePath is outside the configured media root',
    });
  }

  try {
    const result = await resolveAndHashPath(originalFilePath);
    if (result.ok === false) {
      return res.status(result.status).json({ message: result.message });
    }

    const fileRename = await upsertFileRename(db, {
      fileHash: result.hash,
      originalFilePath,
      suggestedFilePath,
    });

    res.status(201).json(fileRename);
  } catch (err) {
    console.error('POST /file-renames failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const getFileRename = async (req: Request, res: Response) => {
  try {
    const fileRename = await getFileRenameById(db, req.params.id);

    if (!fileRename)
      return res.status(404).json({ message: 'file rename not found' });

    res.status(200).json(fileRename);
  } catch (err) {
    console.error(`GET /file-renames/${req.params.id} failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const listFileRenamesHandler = async (req: Request, res: Response) => {
  // req.query is already validated/typed by the validateQuery(listFileRenamesQuerySchema) middleware.
  const {
    fileHash: queryFileHash,
    filePath,
    status,
  } = req.query as ListFileRenamesQuery;

  try {
    let fileHash = queryFileHash;

    if (!fileHash && filePath) {
      const result = await resolveAndHashPath(filePath);
      if (result.ok === false) {
        return res.status(result.status).json({ message: result.message });
      }
      fileHash = result.hash;
    }

    const fileRenames = await listFileRenames(db, { fileHash, status });

    res.status(200).json({ fileRenames });
  } catch (err) {
    console.error('GET /file-renames failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const patchFileRenameStatus = async (req: Request, res: Response) => {
  // req.body is already validated/typed by the validateBody(updateFileRenameStatusSchema) middleware.
  const { status } = req.body as UpdateFileRenameStatusBody;

  try {
    const fileRename = await updateFileRenameStatus(db, req.params.id, status);

    if (!fileRename)
      return res.status(404).json({ message: 'file rename not found' });

    res.status(200).json(fileRename);
  } catch (err) {
    console.error(`PATCH /file-renames/${req.params.id} failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};
