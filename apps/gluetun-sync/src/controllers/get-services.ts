import { Request, Response } from 'express';
import { checkServices } from '../services/serviceStatusService';

// Kept next to getServices so its description can't drift from what the
// handler actually does. Shared by the OpenAPI spec (src/openapi.ts) and the
// matching MCP tool (src/mcp.ts).
export const getServicesOperation = {
  summary:
    'Check whether Gluetun and qBittorrent respond with a 200, as seen from gluetun-sync',
};

export const getServices = async (_: Request, res: Response) => {
  res.status(200).json({ result: await checkServices() });
};
