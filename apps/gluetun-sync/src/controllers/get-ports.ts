import { Request, Response } from 'express';
import { getForwardedPort } from '../api/gluetun/gluetun';
import { getApplicationPreferences, login } from '../api/qbittorrent';

// Kept next to getPorts so its description can't drift from what the
// handler actually does. Shared by the OpenAPI spec (src/openapi.ts) and the
// matching MCP tool (src/mcp.ts).
export const getPortsOperation = {
  summary:
    'Get the forwarded port from Gluetun and the listen_port from qBittorrent, side by side',
};

export type PortsResult = {
  gluetunPort: string | null;
  qbitTorrentPort: string | null;
};
export const getPorts = async (_: Request, res: Response) => {
  const gluetunPort = await getForwardedPort();
  const qbitTorrentLoginResult = await login();
  let qbitTorrentPort = null;
  if (qbitTorrentLoginResult !== null) {
    const preferences = await getApplicationPreferences(qbitTorrentLoginResult);
    qbitTorrentPort = preferences?.listen_port.toString();
  }

  const result: PortsResult = {
    gluetunPort: gluetunPort?.port.toString(),
    qbitTorrentPort,
  };

  res.status(200).json({ result });
};
