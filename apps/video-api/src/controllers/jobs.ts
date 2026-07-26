import { Request, Response } from 'express';
import {
  createVideoJob,
  getVideoJobById,
  listVideoJobs,
} from '@abbottland/video-db';
import { db } from '../db';
import type { CreateJobBody, ListJobsQuery } from '../schemas/jobs';

export const postJob = async (req: Request, res: Response) => {
  // req.body is already validated/typed by the validateBody(createJobSchema) middleware.
  const { operation, inputPath, parameters } = req.body as CreateJobBody;

  try {
    const job = await createVideoJob(db, { operation, inputPath, parameters });

    res.status(201).json({ jobId: job.id, status: job.status });
  } catch (err) {
    console.error('POST /jobs failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const getJob = async (req: Request, res: Response) => {
  try {
    const job = await getVideoJobById(db, req.params.id);

    if (!job) return res.status(404).json({ message: 'job not found' });

    res.status(200).json(job);
  } catch (err) {
    console.error(`GET /jobs/${req.params.id} failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const listJobs = async (req: Request, res: Response) => {
  // req.query is already validated/typed by the validateQuery(listJobsQuerySchema) middleware.
  const { status } = req.query as ListJobsQuery;

  try {
    const jobs = await listVideoJobs(db, { status });

    res.status(200).json({ jobs });
  } catch (err) {
    console.error('GET /jobs failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};
