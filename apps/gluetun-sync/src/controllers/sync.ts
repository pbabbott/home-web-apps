import { SyncCaller } from '../data';
import { syncPorts } from '../services/syncService';
import { Request, Response } from 'express';

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
