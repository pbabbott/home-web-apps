import os from 'os';

export const workerId = `${os.hostname()}-${process.pid}`;

/** The actor recorded on audit events for what the worker does by itself. */
export const systemActor = () => ({ type: 'system' as const, id: workerId });
