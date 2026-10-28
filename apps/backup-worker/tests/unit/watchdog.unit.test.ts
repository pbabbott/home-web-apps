import { DestinationWatchdog } from '../../src/destination/watchdog';

describe('DestinationWatchdog', () => {
  beforeEach(() => jest.useFakeTimers({ now: 0 }));
  afterEach(() => jest.useRealTimers());

  const make = (onStall = jest.fn()) => ({
    onStall,
    watchdog: new DestinationWatchdog(1000, onStall, {
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (h) => clearTimeout(h as NodeJS.Timeout),
    }),
  });

  it('passes results and errors through', async () => {
    const { watchdog } = make();

    await expect(watchdog.run('a', async () => 5)).resolves.toBe(5);
    await expect(
      watchdog.run('b', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(watchdog.state()).toEqual({ stalled: false });
  });

  it('is not stalled while calls finish in time', async () => {
    const { watchdog, onStall } = make();
    const p = watchdog.run(
      'fast',
      () => new Promise((r) => setTimeout(r, 500)),
    );

    await jest.advanceTimersByTimeAsync(500);
    await p;

    await jest.advanceTimersByTimeAsync(5000);
    expect(onStall).not.toHaveBeenCalled();
    expect(watchdog.state().stalled).toBe(false);
  });

  it('reports a stalled call once, and clears when it returns', async () => {
    const { watchdog, onStall } = make();
    let release!: () => void;
    const p = watchdog.run(
      'write',
      () => new Promise<void>((r) => (release = r)),
    );

    await jest.advanceTimersByTimeAsync(1000);
    expect(onStall).toHaveBeenCalledTimes(1);
    expect(onStall).toHaveBeenCalledWith('write');

    await jest.advanceTimersByTimeAsync(2000);
    expect(onStall).toHaveBeenCalledTimes(1);
    expect(watchdog.state()).toMatchObject({
      stalled: true,
      operation: 'write',
      stalledForMs: 2000,
    });

    release();
    await p;
    expect(watchdog.state()).toEqual({ stalled: false });
  });

  it('survives a throwing stall handler', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const { watchdog } = make(
      jest.fn(() => {
        throw new Error('handler');
      }),
    );
    const p = watchdog.run('x', () => new Promise((r) => setTimeout(r, 2000)));

    await jest.advanceTimersByTimeAsync(2000);
    await p;
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
