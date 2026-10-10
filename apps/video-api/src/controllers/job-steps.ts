import { Request, Response } from 'express';
import { listVideoJobStepsByJobId } from '@abbottland/video-db';
import { db } from '../db';
import {
  pushSnapshotAndMaybeClose,
  subscribeToJobSteps,
  unsubscribeFromJobSteps,
} from '../job-steps-stream';

export const getJobSteps = async (req: Request, res: Response) => {
  try {
    const steps = await listVideoJobStepsByJobId(db, req.params.id);

    res.status(200).json(steps);
  } catch (err) {
    console.error(`GET /jobs/${req.params.id}/steps failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const streamJobSteps = async (req: Request, res: Response) => {
  const jobId = req.params.id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  subscribeToJobSteps(jobId, res);
  req.on('close', () => unsubscribeFromJobSteps(jobId, res));

  try {
    await pushSnapshotAndMaybeClose(jobId, res);
  } catch (err) {
    console.error(`GET /jobs/${jobId}/steps/stream failed:`, err);
    unsubscribeFromJobSteps(jobId, res);
    res.end();
  }
};
