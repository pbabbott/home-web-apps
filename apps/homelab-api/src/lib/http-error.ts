/** A failure with a specific HTTP status, for `handle` to answer as-is. */
export class HttpError extends Error {
  constructor(
    readonly status: 403 | 413 | 415 | 422 | 502 | 503,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
