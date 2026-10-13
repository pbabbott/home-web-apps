import { Request, Response } from 'express';
import * as hostsService from '../services/hosts';
import * as hostMetricsService from '../services/host-metrics';
import type {
  CreateHostBody,
  HostCpuQuery,
  HostIdParams,
  HostListQuery,
  UpdateHostBody,
} from '../schemas/hosts';

export const listHosts = async (req: Request, res: Response) => {
  const { type } = req.query as HostListQuery;

  try {
    const hosts = await hostsService.listHosts(type);
    res.status(200).json(hosts);
  } catch (err) {
    console.error('GET /hosts failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const getHost = async (req: Request, res: Response) => {
  const { id } = req.params as HostIdParams;

  try {
    const host = await hostsService.getHost(id);
    if (!host) {
      res.status(404).json({ message: 'host not found' });
      return;
    }
    res.status(200).json(host);
  } catch (err) {
    console.error(`GET /hosts/${id} failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const createHost = async (req: Request, res: Response) => {
  const body = req.body as CreateHostBody;

  try {
    const host = await hostsService.createHost(body);
    res.status(201).json(host);
  } catch (err) {
    console.error('POST /hosts failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const deleteHost = async (req: Request, res: Response) => {
  const { id } = req.params as HostIdParams;

  try {
    const host = await hostsService.deleteHost(id);
    if (!host) {
      res.status(404).json({ message: 'host not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error(`DELETE /hosts/${id} failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const getHostCpuMetrics = async (req: Request, res: Response) => {
  const { id } = req.params as HostIdParams;
  const { rangeSeconds, stepSeconds } = req.query as unknown as HostCpuQuery;

  try {
    const metrics = await hostMetricsService.getHostCpuSeries(id, {
      rangeSeconds,
      stepSeconds,
    });
    if (!metrics) {
      res.status(404).json({ message: 'host not found' });
      return;
    }
    res.status(200).json(metrics);
  } catch (err) {
    console.error(`GET /hosts/${id}/metrics/cpu failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const updateHost = async (req: Request, res: Response) => {
  const { id } = req.params as HostIdParams;
  const body = req.body as UpdateHostBody;

  try {
    const host = await hostsService.updateHost(id, body);
    if (!host) {
      res.status(404).json({ message: 'host not found' });
      return;
    }
    res.status(200).json(host);
  } catch (err) {
    console.error(`PATCH /hosts/${id} failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};
