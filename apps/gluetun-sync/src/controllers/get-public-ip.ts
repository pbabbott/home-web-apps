import { Request, Response } from 'express';
import { showPublicIp } from '../services/publicIpService';

// Kept next to getPublicIp so its description can't drift from what the
// handler actually does. Shared by the OpenAPI spec (src/openapi.ts) and the
// matching MCP tool (src/mcp.ts).
export const getPublicIpOperation = {
  summary:
    'Get the current public IP and its region, country and city, as reported by Gluetun (ipify is the fallback for the IP)',
};

export const getPublicIp = async (req: Request, res: Response) => {
  const publicIP = await showPublicIp();

  if (publicIP === null)
    res.status(503).json({ message: 'Could not get public IP' });
  else res.status(200).json({ result: publicIP });
};
