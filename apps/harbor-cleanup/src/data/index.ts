import type { CleanupResult } from '../services/cleanupService';

export type CleanupCaller = 'CRON' | 'API';

export type StatusRecord = {
  lastRunStart?: Date;
  lastRunEnd?: Date;
  lastSuccess?: Date;
  lastFailure?: Date;
  lastFailureMessage?: string;
  lastCaller?: CleanupCaller;
  lastResult?: CleanupResult;
};

const store: StatusRecord = {};

export const getStatusRecord = (): StatusRecord => store;

export const logRunStart = (caller: CleanupCaller) => {
  store.lastRunStart = new Date();
  store.lastCaller = caller;
};

export const logRunSuccess = (result: CleanupResult) => {
  store.lastRunEnd = new Date();
  store.lastSuccess = new Date();
  store.lastResult = result;
};

export const logRunFailure = (message: string) => {
  store.lastRunEnd = new Date();
  store.lastFailure = new Date();
  store.lastFailureMessage = message;
};
