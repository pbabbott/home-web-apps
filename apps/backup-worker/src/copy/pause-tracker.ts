const BASE_MS = 30_000;
const CAP_MS = 5 * 60_000;

/**
 * Backoff for the two causes that pause a job: a source that does not answer
 * (`source:<jobId>`) and a destination that is unhealthy (`destination`). It
 * lives in memory. A cause that is gone for a moment and returns (a probe
 * passes, the next item fails again) keeps its failure count, so it waits
 * longer each time instead of flooding the audit log with stalled/resumed
 * pairs; only a settled item resets it.
 */
export class PauseTracker {
  private readonly state = new Map<
    string,
    { failures: number; nextAt: number }
  >();

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly baseMs = BASE_MS,
    private readonly capMs = CAP_MS,
  ) {}

  /** Records another failure and returns when to look again. */
  fail(key: string): Date {
    const failures = (this.state.get(key)?.failures ?? 0) + 1;
    const nextAt =
      this.now() + Math.min(this.baseMs * 2 ** (failures - 1), this.capMs);

    this.state.set(key, { failures, nextAt });

    return new Date(nextAt);
  }

  /** True when nothing is known about `key` or its wait is over. */
  due(key: string): boolean {
    const entry = this.state.get(key);

    return !entry || this.now() >= entry.nextAt;
  }

  reset(key: string): void {
    this.state.delete(key);
  }

  /** Forgets every key that starts with `prefix`. */
  resetPrefix(prefix: string): void {
    for (const key of this.state.keys()) {
      if (key.startsWith(prefix)) this.state.delete(key);
    }
  }
}

export const DESTINATION_KEY = 'destination';
export const sourceKey = (jobId: string) => `source:${jobId}`;
