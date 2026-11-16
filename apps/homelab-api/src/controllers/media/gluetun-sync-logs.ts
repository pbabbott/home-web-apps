import { Request, Response } from 'express';
import { readPodLogByLabel } from '../../api/kubernetes/kubernetes-client';
import type { LogsQuery } from '../../schemas/media';
import type { Operation } from '../operation';

// gluetun-sync runs as a sidecar in the qbittorrent-vpn pod (label api=gluetun).
const NAMESPACE = 'media';
const POD_LABEL_SELECTOR = 'api=gluetun';
const CONTAINER = 'gluetun-sync';

export const getGluetunSyncLogsOperation = {
  summary: 'Recent log lines from the gluetun-sync container',
  description:
    'Reads the tail of the gluetun-sync sidecar in the media namespace through the Kubernetes API (oldest first). 404 when the pod is not running or the cluster is not reachable.',
  hud: '/media',
} satisfies Operation;

export const getGluetunSyncLogs = async (req: Request, res: Response) => {
  const { tail } = req.query as unknown as LogsQuery;

  try {
    const lines = await readPodLogByLabel(
      NAMESPACE,
      POD_LABEL_SELECTOR,
      CONTAINER,
      tail,
    );
    if (lines === null) {
      res.status(404).json({ message: 'gluetun-sync pod not found' });
      return;
    }
    res.status(200).json({ lines });
  } catch (err) {
    console.error('GET /media/gluetun-sync/logs failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};
