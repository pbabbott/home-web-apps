import { SyncCaller } from '../data';
import { syncPorts } from '../services/syncService';
import { Request, Response } from 'express';

// Kept next to doSync so its description can't drift from what the handler
// actually does. Shared by the OpenAPI spec (src/openapi.ts) and the MCP
// sync_ports tool (src/mcp.ts).
export const doSyncOperation = {
  summary: 'Trigger a port sync between Gluetun and qBittorrent',
  description:
    'Reads the forwarded port from Gluetun and, if it differs from qBittorrent listen_port, updates qBittorrent to match. Returns whether the sync succeeded.',
};

export const doSync = async (_: Request, res: Response) => {
  try {
    const result = await syncPorts(SyncCaller.API);

    console.log('syncResult', result);

    if (result.success)
      return res.status(200).json({ message: result.validationMessage });

    return res.status(502).json({ message: result.validationMessage });
  } catch (err) {
    res.status(500).json({ message: err });
  }
};
