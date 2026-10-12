import { Request, Response } from 'express';
import { buildPodMap } from '../services/pod-map';
import type { MapQuery, MapTypeParams } from '../schemas/maps';

export const getMap = async (req: Request, res: Response) => {
  // req.params/req.query are already validated/typed by the
  // validateParams(mapTypeParamsSchema) / validateQuery(mapQuerySchema)
  // middleware.
  const { type } = req.params as MapTypeParams;
  const { metric, groupBy } = req.query as MapQuery;

  try {
    // Only "pods" exists today — add a branch here when "deployments"/"nodes"
    // land (schemas/maps.ts's mapTypeParamsSchema enum gains the value first).
    const map = await buildPodMap(metric, groupBy);
    res.status(200).json(map);
  } catch (err) {
    console.error(`GET /maps/${type} failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};
