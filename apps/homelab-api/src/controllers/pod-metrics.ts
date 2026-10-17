import { Request, Response } from 'express';
import * as podMetricsService from '../services/pod-metrics';
import type { PodMetricsParams, PodMetricsRangeQuery } from '../schemas/pods';

export const getPodCpuMetrics = async (req: Request, res: Response) => {
  const { namespace, pod } = req.params as PodMetricsParams;
  const { rangeSeconds, stepSeconds } =
    req.query as unknown as PodMetricsRangeQuery;

  try {
    const metrics = await podMetricsService.getPodCpuSeries(namespace, pod, {
      rangeSeconds,
      stepSeconds,
    });
    if (!metrics) {
      res.status(404).json({ message: 'pod not found' });
      return;
    }
    res.status(200).json(metrics);
  } catch (err) {
    console.error(`GET /pods/${namespace}/${pod}/metrics/cpu failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const getPodMemoryMetrics = async (req: Request, res: Response) => {
  const { namespace, pod } = req.params as PodMetricsParams;
  const { rangeSeconds, stepSeconds } =
    req.query as unknown as PodMetricsRangeQuery;

  try {
    const metrics = await podMetricsService.getPodMemorySeries(namespace, pod, {
      rangeSeconds,
      stepSeconds,
    });
    if (!metrics) {
      res.status(404).json({ message: 'pod not found' });
      return;
    }
    res.status(200).json(metrics);
  } catch (err) {
    console.error(`GET /pods/${namespace}/${pod}/metrics/memory failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};
