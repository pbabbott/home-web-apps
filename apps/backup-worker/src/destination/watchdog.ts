export type WatchdogState = {
  stalled: boolean;
  /** The longest-running stalled operation, when `stalled`. */
  operation?: string;
  stalledSince?: number;
  /** How long it has been stalled, in ms, when `stalled`. */
  stalledForMs?: number;
};

export type WatchdogDeps = {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

const realDeps: WatchdogDeps = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

/**
 * The NAS mount is `hard`: an outage blocks file calls instead of failing
 * them. Destination operations run under `run`; one that has not returned
 * after `stallTimeoutMs` makes the worker `stalled` (reported by /readyz and,
 * after a longer grace) and tells its `onStall` listeners once per stall. The
 * state clears when the call returns. A call that never returns cannot be
 * cancelled, which is why the pod is restarted rather than recovered.
 */
export class DestinationWatchdog {
  private readonly inFlight = new Map<
    number,
    { operation: string; startedAt: number; stalled: boolean }
  >();
  private readonly listeners = new Set<(operation: string) => void>();
  private nextId = 0;

  constructor(
    private readonly stallTimeoutMs: number,
    private readonly deps: WatchdogDeps = realDeps,
  ) {}

  /** Calls `listener` when a call stalls. The function this returns removes it. */
  onStall(listener: (operation: string) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async run<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const id = this.nextId++;
    const entry = {
      operation,
      startedAt: this.deps.now(),
      stalled: false,
    };
    this.inFlight.set(id, entry);

    const timer = this.deps.setTimeout(() => {
      entry.stalled = true;
      for (const listener of this.listeners) {
        try {
          listener(operation);
        } catch (err) {
          console.error('❌ destination stall handler failed:', err);
        }
      }
    }, this.stallTimeoutMs);

    try {
      return await fn();
    } finally {
      this.deps.clearTimeout(timer);
      this.inFlight.delete(id);
    }
  }

  state(): WatchdogState {
    let oldest: { operation: string; startedAt: number } | undefined;

    for (const entry of this.inFlight.values()) {
      if (entry.stalled && (!oldest || entry.startedAt < oldest.startedAt)) {
        oldest = entry;
      }
    }

    if (!oldest) return { stalled: false };

    return {
      stalled: true,
      operation: oldest.operation,
      stalledSince: oldest.startedAt + this.stallTimeoutMs,
      stalledForMs: this.deps.now() - (oldest.startedAt + this.stallTimeoutMs),
    };
  }
}
