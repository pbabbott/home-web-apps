/**
 * A rule violation the caller can act on: the row is missing (`not_found`)
 * or the request conflicts with current state (`conflict`) — a duplicate
 * name, an illegal status transition, a lost lease. `details` carries
 * structured context (e.g. queue counts blocking job completion).
 */
export class DiscoveryError extends Error {
  constructor(
    readonly code: 'not_found' | 'conflict',
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DiscoveryError';
  }
}
