import os from 'os';
import { claimNextVideoJob } from '@abbottland/video-db';
import { db } from '../db';
import { config } from '../config';
import { processJob } from './job-processor';

export const workerId = `${os.hostname()}-${process.pid}`;

let stopped = false;
let pollTimeout: NodeJS.Timeout | undefined;
let currentJobPromise: Promise<void> | undefined;

const scheduleNextPoll = (delayMs: number) => {
  if (stopped) return;
  pollTimeout = setTimeout(() => void pollOnce(), delayMs);
};

export const pollOnce = async (): Promise<void> => {
  if (stopped) return;

  let job;
  try {
    job = await claimNextVideoJob(db, workerId);
  } catch (err) {
    console.error('❌ failed to claim next job:', err);
    scheduleNextPoll(config.pollIntervalMs);
    return;
  }

  if (!job) {
    scheduleNextPoll(config.pollIntervalMs);
    return;
  }

  console.log(`▶️  claimed job ${job.id} (${job.operation})`);

  currentJobPromise = processJob(job);
  await currentJobPromise;
  currentJobPromise = undefined;

  // A job just finished — check immediately for another pending one instead
  // of waiting out the idle poll interval.
  scheduleNextPoll(0);
};

export const startPollLoop = () => {
  stopped = false;
  void pollOnce();
};

/** Stops scheduling new polls and waits for any in-flight job to finish. */
export const stopPollLoop = async (): Promise<void> => {
  stopped = true;

  if (pollTimeout) clearTimeout(pollTimeout);
  if (currentJobPromise) await currentJobPromise;
};
