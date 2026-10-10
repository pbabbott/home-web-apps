import { Client, type Notification } from 'pg';
import type { Response } from 'express';
import {
  getVideoJobById,
  listVideoJobStepsByJobId,
  type PostgresConnectionOptions,
} from '@abbottland/video-db';
import { db } from './db';

const CHANNEL = 'video_job_steps';

// jobId -> every open SSE response currently watching that job. A
// notification only triggers a re-query for jobs someone is actually
// watching, so idle jobs cost nothing.
const subscribers = new Map<string, Set<Response>>();

let listenClient: Client | undefined;

/**
 * Writes the current job + steps snapshot as one SSE frame, then ends the
 * response once the job reaches a terminal state (or doesn't exist at all —
 * nothing will ever change that). Used both for a connection's initial
 * snapshot (handles "job was already finished when the client connected")
 * and for every subsequent notification.
 *
 * Note: ending the response here does NOT stop a browser EventSource from
 * auto-reconnecting on its own — that's native EventSource behavior on any
 * connection close. The client is responsible for calling `close()` itself
 * once it sees a terminal job status in the payload.
 */
export const pushSnapshotAndMaybeClose = async (
  jobId: string,
  res: Response,
): Promise<void> => {
  const [job, steps] = await Promise.all([
    getVideoJobById(db, jobId),
    listVideoJobStepsByJobId(db, jobId),
  ]);

  res.write(`data: ${JSON.stringify({ job, steps })}\n\n`);

  if (!job || job.status === 'completed' || job.status === 'failed') {
    unsubscribeFromJobSteps(jobId, res);
    res.end();
  }
};

export const subscribeToJobSteps = (jobId: string, res: Response): void => {
  const existing = subscribers.get(jobId);

  if (existing) {
    existing.add(res);
  } else {
    subscribers.set(jobId, new Set([res]));
  }
};

export const unsubscribeFromJobSteps = (jobId: string, res: Response): void => {
  const existing = subscribers.get(jobId);

  if (!existing) return;

  existing.delete(res);
  if (existing.size === 0) subscribers.delete(jobId);
};

const handleNotification = (msg: Notification): void => {
  if (msg.channel !== CHANNEL || !msg.payload) return;

  const jobId = msg.payload;
  const subscribed = subscribers.get(jobId);

  if (!subscribed || subscribed.size === 0) return;

  for (const res of subscribed) {
    pushSnapshotAndMaybeClose(jobId, res).catch((err) => {
      console.error(`⚠️  failed to push job steps for ${jobId}:`, err);
    });
  }
};

/**
 * Opens a dedicated `pg.Client` (never the pool — `pg` only emits
 * `notification` events on a connection that issued LISTEN) and listens for
 * every job/step change in the database. Reconnect-on-drop is intentionally
 * out of scope for this pass: if this connection drops, open SSE streams go
 * silent until the process restarts.
 */
export const initJobStepsListener = async (
  options: PostgresConnectionOptions,
): Promise<void> => {
  listenClient = new Client(options);

  await listenClient.connect();
  await listenClient.query(`LISTEN ${CHANNEL}`);

  listenClient.on('notification', handleNotification);
  listenClient.on('error', (err) => {
    console.error('⚠️  job-steps LISTEN connection error:', err);
  });
};

/** Closes the dedicated LISTEN connection — used by tests and graceful shutdown. */
export const stopJobStepsListener = async (): Promise<void> => {
  await listenClient?.end();
  listenClient = undefined;
};
