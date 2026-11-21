/** An expected, operation-level failure: its message is recorded on the job as-is. */
export class JobProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JobProcessingError';
  }
}
