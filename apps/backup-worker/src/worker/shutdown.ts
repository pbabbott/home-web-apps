import { ShutdownError } from '../copy/errors';

let controller = new AbortController();

/** Aborted (with a `ShutdownError`) once the worker is asked to stop. */
export const shutdownSignal = (): AbortSignal => controller.signal;

/** SIGTERM: stop the transfer in flight; the item is released and its attempt refunded. */
export const requestShutdown = (): void => {
  if (!controller.signal.aborted) controller.abort(new ShutdownError());
};

export const resetShutdown = (): void => {
  controller = new AbortController();
};
