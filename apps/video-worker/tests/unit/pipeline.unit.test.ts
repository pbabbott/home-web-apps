import { runSteps, type Step } from '../../src/worker/operations/pipeline';

describe('runSteps', () => {
  it('returns the initial context unchanged when there are no steps', async () => {
    const result = await runSteps({ count: 0 }, []);

    expect(result).toEqual({ count: 0 });
  });

  it('threads context through steps in order', async () => {
    const increment: Step<{ count: number }> = async (ctx) => ({
      count: ctx.count + 1,
    });
    const double: Step<{ count: number }> = async (ctx) => ({
      count: ctx.count * 2,
    });

    const result = await runSteps({ count: 1 }, [increment, double]);

    expect(result).toEqual({ count: 4 });
  });
});
