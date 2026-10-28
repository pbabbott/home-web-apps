import { Request, Response } from 'express';
import { config } from '../config';
import { getWatchdog } from '../destination/runtime';

/**
 * Liveness. Fails only when a destination call has been stalled for longer
 * than the stall timeout again (a grace after /readyz started failing), so
 * Kubernetes restarts the pod and the lease can expire.
 */
export const getHealth = (_req: Request, res: Response) => {
  const state = getWatchdog().state();
  const graceMs = config.backupStallTimeoutSeconds * 1000;

  if (state.stalled && (state.stalledForMs ?? 0) > graceMs) {
    console.error(
      `GET /healthz failed - destination stalled: ${state.operation}`,
    );
    return res
      .status(503)
      .json({ status: 'error', message: 'destination stalled' });
  }

  res.json({ status: 'ok' });
};
