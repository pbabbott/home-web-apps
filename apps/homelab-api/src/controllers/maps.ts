import { Request, Response } from 'express';
import { buildPodMap } from '../services/pod-map';
import type { MapQuery, MapTypeParams } from '../schemas/maps';
import type { Operation } from './operation';

export const getMapOperation = {
  summary: 'Fetch a status map for a Kubernetes resource type',
  description:
    'Today only type=pods is supported. Each item status is driven by the requested metric: cpu/memory/both use usage ÷ limit (falling back to request, then node-relative capacity); restarts is relative to the worst pod in this response (fewer than 10 restarts is always healthy). Pass groupBy to have items pre-grouped by namespace/node/workload.',
} satisfies Operation;

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
