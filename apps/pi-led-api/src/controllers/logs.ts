import { Request, Response } from 'express';
import { readFileSync } from 'fs';
import path from 'path';

export const getLogs = (req: Request, res: Response) => {
  try {
    const logFilePath = path.resolve('/opt/pironman/log');
    // TODO: add validation
    const { lines = 10 } = req.query;

    const logContent = readFileSync(logFilePath, 'utf-8');
    const logLines = logContent.split('\n');
    const recentLogLines = logLines.slice(-lines as number);

    res.send({ logEntries: recentLogLines });
  } catch (error) {
    console.error('Error reading log file:', error);
    res.status(500).send({ error: 'Failed to read log file' });
  }
};
