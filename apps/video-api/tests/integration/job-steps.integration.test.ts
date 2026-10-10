import {
  completeVideoJob,
  completeVideoJobStep,
  createVideoJob,
  createVideoJobStep,
  failVideoJob,
} from '@abbottland/video-db';
import { config } from '../../src/config';
import { db } from '../../src/db';
import {
  initJobStepsListener,
  pushSnapshotAndMaybeClose,
  stopJobStepsListener,
  subscribeToJobSteps,
  unsubscribeFromJobSteps,
} from '../../src/job-steps-stream';

// A stand-in for Express's Response — just enough to capture what the
// stream module writes/ends, without going through a real HTTP connection
// (SSE over supertest can't observe incremental frames on an open response).
const fakeResponse = () => {
  const writes: string[] = [];
  let ended = false;

  return {
    write: (chunk: string) => {
      writes.push(chunk);
      return true;
    },
    end: () => {
      ended = true;
    },
    writes,
    get ended() {
      return ended;
    },
  } as unknown as import('express').Response & {
    writes: string[];
    ended: boolean;
  };
};

const POLL_INTERVAL_MS = 20;
const POLL_TIMEOUT_MS = 2000;

/** Polls until `predicate()` is true or the timeout elapses. */
const waitFor = async (predicate: () => boolean): Promise<void> => {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error('waitFor timed out');
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
};

describe('job-steps LISTEN/NOTIFY', () => {
  beforeAll(async () => {
    await initJobStepsListener(config.postgres);
  });

  afterAll(async () => {
    await stopJobStepsListener();
  });

  it('pushes an updated snapshot when a step completes', async () => {
    const job = await createVideoJob(db, {
      operation: 'paw_patrol_title_cards',
      parameters: { seasonNumber: 1 },
    });
    const step = await createVideoJobStep(db, {
      jobId: job.id,
      stepName: 'list-season-files',
      message: 'Listing season files',
    });

    const res = fakeResponse();
    subscribeToJobSteps(job.id, res);

    await completeVideoJobStep(db, step.id, 'Listing season files — done');

    await waitFor(() => res.writes.length > 0);

    const payload = JSON.parse(res.writes[0].replace(/^data: /, ''));
    expect(payload.job.id).toBe(job.id);
    expect(payload.steps).toHaveLength(1);
    expect(payload.steps[0].status).toBe('completed');

    unsubscribeFromJobSteps(job.id, res);
  });

  it('closes the subscriber once the job reaches a terminal state', async () => {
    const job = await createVideoJob(db, {
      operation: 'paw_patrol_title_cards',
      parameters: { seasonNumber: 2 },
    });

    const res = fakeResponse();
    subscribeToJobSteps(job.id, res);

    await completeVideoJob(db, job.id, 'done');

    await waitFor(() => res.ended);

    expect(res.ended).toBe(true);
  });

  it('marks a subscriber closed on job failure too', async () => {
    const job = await createVideoJob(db, {
      operation: 'paw_patrol_title_cards',
      parameters: { seasonNumber: 3 },
    });

    const res = fakeResponse();
    subscribeToJobSteps(job.id, res);

    await failVideoJob(db, job.id, 'boom');

    await waitFor(() => res.ended);

    expect(res.ended).toBe(true);
  });

  it('closes immediately for a job id that does not exist', async () => {
    const res = fakeResponse();

    await pushSnapshotAndMaybeClose(
      '00000000-0000-0000-0000-000000000000',
      res,
    );

    expect(res.ended).toBe(true);

    const payload = JSON.parse(res.writes[0].replace(/^data: /, ''));
    expect(payload.job).toBeUndefined();
    expect(payload.steps).toEqual([]);
  });
});
