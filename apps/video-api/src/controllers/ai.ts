import { Request, Response } from 'express';
import { getAiStatus } from '../api/ai/ai-client';

export const getAiStatusRoute = async (_req: Request, res: Response) => {
  const status = await getAiStatus();

  res.status(200).json(status);
};
