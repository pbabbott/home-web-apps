import type { Request, Response } from 'express';
import { runCleanup } from '../services/cleanupService';

export const doCleanup = async (_req: Request, res: Response) => {
  console.log('[cleanup] POST /cleanup triggered');
  try {
    const result = await runCleanup();
    const status = result.totalErrors > 0 ? 207 : 200;
    res.status(status).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cleanup] Unhandled error:', message);
    res.status(500).json({ error: message });
  }
};
