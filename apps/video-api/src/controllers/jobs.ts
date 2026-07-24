import { Request, Response } from 'express';
import { createVideoJob, getVideoJobById } from '@abbottland/video-db';
import { db } from '../db';

const SUPPORTED_OPERATIONS = ['screenshots'];

export const postJob = async (req: Request, res: Response) => {
  const { operation, inputPath, parameters } = req.body ?? {};

  if (
    typeof operation !== 'string' ||
    !SUPPORTED_OPERATIONS.includes(operation)
  ) {
    return res.status(400).json({
      message: `operation must be one of: ${SUPPORTED_OPERATIONS.join(', ')}`,
    });
  }

  if (typeof inputPath !== 'string' || inputPath === '') {
    return res.status(400).json({ message: 'inputPath is required' });
  }

  if (operation === 'screenshots') {
    const timestamps = parameters?.timestamps;
    if (
      !Array.isArray(timestamps) ||
      timestamps.length === 0 ||
      !timestamps.every((t) => typeof t === 'number')
    ) {
      return res.status(400).json({
        message: 'parameters.timestamps must be a non-empty array of numbers',
      });
    }
  }

  try {
    const job = await createVideoJob(db, {
      operation,
      inputPath,
      parameters: parameters ?? {},
    });

    res.status(201).json({ jobId: job.id, status: job.status });
  } catch (err) {
    res.status(500).json({ message: err });
  }
};

export const getJob = async (req: Request, res: Response) => {
  try {
    const job = await getVideoJobById(db, req.params.id);

    if (!job) return res.status(404).json({ message: 'job not found' });

    res.status(200).json(job);
  } catch (err) {
    res.status(500).json({ message: err });
  }
};
