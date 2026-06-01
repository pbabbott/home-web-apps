export class RequestThrottler {
  private lastRequestTime = 0;

  constructor(private readonly intervalMs: number) {}

  async wait(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.intervalMs) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, this.intervalMs - elapsed),
      );
    }
    this.lastRequestTime = Date.now();
  }
}
