import { Request, Response } from 'express';
import { getStatusRecord, StatusRecord } from '../data/index';

// Kept next to getStatus so its description can't drift from what the
// handler actually does. Shared by the OpenAPI spec (src/openapi.ts) and the
// matching MCP tool (src/mcp.ts).
export const getStatusOperation = {
  summary: 'Get the last recorded sync attempt/result',
};

export type StatusResult = {
  result: StatusRecord;
};
export const getStatus = async (req: Request, res: Response) => {
  const statusRecord = getStatusRecord();

  const statusResult: StatusResult = {
    result: statusRecord,
  };

  res.status(200).json(statusResult);
};
