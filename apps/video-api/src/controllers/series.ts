import { Request, Response } from 'express';
import { listSeries as listSeriesQuery } from '@abbottland/video-db';
import { db } from '../db';

export const listSeries = async (_req: Request, res: Response) => {
  try {
    const series = await listSeriesQuery(db);

    res.status(200).json({ series });
  } catch (err) {
    console.error('GET /series failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};
