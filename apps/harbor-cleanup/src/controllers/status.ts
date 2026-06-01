import type { Request, Response } from 'express';
import { getStatusRecord } from '../data';
import { config } from '../config';
import cronstrue from 'cronstrue';

export const getStatus = (_req: Request, res: Response) => {
  res.status(200).json({
    schedule: cronstrue.toString(config.cronExpression),
    cronExpression: config.cronExpression,
    timezone: config.TZ,
    ...getStatusRecord(),
  });
};
