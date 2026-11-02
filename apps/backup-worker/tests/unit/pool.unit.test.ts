import { runPool } from '../../src/copy/pool';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('runPool', () => {
  it('runs every task, never more than the limit at once, starting in order', async () => {
    const started: number[] = [];
    let active = 0;
    let peak = 0;

    await runPool(3, 10, async (i) => {
      started.push(i);
      peak = Math.max(peak, ++active);
      await delay(5);
      active--;
    });

    expect(started).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(peak).toBe(3);
  });

  it('is a sequential loop with a limit of 1', async () => {
    const order: string[] = [];

    await runPool(1, 3, async (i) => {
      order.push(`start ${i}`);
      await delay(2);
      order.push(`end ${i}`);
    });

    expect(order).toEqual([
      'start 0',
      'end 0',
      'start 1',
      'end 1',
      'start 2',
      'end 2',
    ]);
  });

  it('handles fewer tasks than the limit and none at all', async () => {
    const ran: number[] = [];

    await runPool(8, 2, async (i) => void ran.push(i));
    await runPool(8, 0, async (i) => void ran.push(i));

    expect(ran).toEqual([0, 1]);
  });

  it('starts nothing new after a failure, waits for the running tasks and throws the first error', async () => {
    const started: number[] = [];
    const finished: number[] = [];
    const seen: unknown[] = [];

    await expect(
      runPool(
        2,
        10,
        async (i) => {
          started.push(i);
          if (i === 1) {
            await delay(2);
            throw new Error('first');
          }
          await delay(15);
          finished.push(i);
          if (i === 0) throw new Error('second');
        },
        (error) => seen.push(error),
      ),
    ).rejects.toThrow('first');

    expect(started).toEqual([0, 1]);
    expect(finished).toEqual([0]);
    expect(seen).toHaveLength(1);
  });
});
