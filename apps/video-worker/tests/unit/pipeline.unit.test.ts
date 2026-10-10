import type { VideoJob } from '@abbottland/video-db';
import {
  runSteps,
  type NamedStep,
  type Step,
} from '../../src/worker/operations/pipeline';

jest.mock('../../src/db', () => ({ db: {} }));

const createVideoJobStep = jest.fn();
const completeVideoJobStep = jest.fn();
const failVideoJobStep = jest.fn();

jest.mock('@abbottland/video-db', () => ({
  createVideoJobStep: (...args: unknown[]) => createVideoJobStep(...args),
  completeVideoJobStep: (...args: unknown[]) => completeVideoJobStep(...args),
  failVideoJobStep: (...args: unknown[]) => failVideoJobStep(...args),
}));

type CountContext = { job: VideoJob; count: number };

const buildContext = (count: number): CountContext =>
  ({ job: { id: 'job-1' } as VideoJob, count }) as CountContext;

const namedStep = (
  name: string,
  run: Step<CountContext>,
): NamedStep<CountContext> => ({ name, message: `Running ${name}`, run });

describe('runSteps', () => {
  beforeEach(() => {
    createVideoJobStep.mockResolvedValue({ id: 'step-1' });
    completeVideoJobStep.mockResolvedValue(undefined);
    failVideoJobStep.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the initial context unchanged when there are no steps', async () => {
    const result = await runSteps(buildContext(0), []);

    expect(result).toEqual(buildContext(0));
    expect(createVideoJobStep).not.toHaveBeenCalled();
  });

  it('threads context through steps in order, recording each as it runs', async () => {
    const increment = namedStep('increment', async (ctx) => ({
      ...ctx,
      count: ctx.count + 1,
    }));
    const double = namedStep('double', async (ctx) => ({
      ...ctx,
      count: ctx.count * 2,
    }));

    const result = await runSteps(buildContext(1), [increment, double]);

    expect(result.count).toBe(4);
    expect(createVideoJobStep).toHaveBeenCalledTimes(2);
    expect(createVideoJobStep).toHaveBeenNthCalledWith(
      1,
      {},
      {
        jobId: 'job-1',
        stepName: 'increment',
        message: 'Running increment',
      },
    );
    expect(completeVideoJobStep).toHaveBeenNthCalledWith(
      1,
      {},
      'step-1',
      'Running increment — done',
    );
    expect(createVideoJobStep).toHaveBeenNthCalledWith(
      2,
      {},
      {
        jobId: 'job-1',
        stepName: 'double',
        message: 'Running double',
      },
    );
    expect(failVideoJobStep).not.toHaveBeenCalled();
  });

  it('records a step failure and rethrows without running later steps', async () => {
    const failing = namedStep('failing', async () => {
      throw new Error('boom');
    });
    const neverRuns = namedStep('never-runs', async (ctx) => ctx);
    const neverRunsFn = jest.fn(neverRuns.run);

    await expect(
      runSteps(buildContext(0), [failing, { ...neverRuns, run: neverRunsFn }]),
    ).rejects.toThrow('boom');

    expect(failVideoJobStep).toHaveBeenCalledWith({}, 'step-1', 'boom');
    expect(completeVideoJobStep).not.toHaveBeenCalled();
    expect(neverRunsFn).not.toHaveBeenCalled();
  });
});
