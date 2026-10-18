import { Request, Response } from 'express';
import { HostInUseError } from '@abbottland/homelab-db';
import * as hostsService from '../services/hosts';
import * as hostMetricsService from '../services/host-metrics';
import type {
  CreateHostBody,
  HostIdParams,
  HostListQuery,
  HostMetricsRangeQuery,
  UpdateHostBody,
} from '../schemas/hosts';
import type { Operation } from './operation';

export const listHostsOperation = {
  summary: 'List registered hosts, enriched with live Prometheus data',
  description:
    'status/cpuUsageRatio are best-effort: a host with no instance, or whose node-exporter data has not reached Prometheus, still returns with status="unknown" rather than failing the request.',
} satisfies Operation;

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

export const getHostOperation = {
  summary: 'Fetch a single host, enriched with live Prometheus data',
} satisfies Operation;

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

export const createHostOperation = {
  summary: 'Register a new host',
} satisfies Operation;

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

export const deleteHostOperation = {
  summary: 'Delete a host',
} satisfies Operation;

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
    if (err instanceof HostInUseError) {
      res.status(409).json({
        message: 'host is in use (e.g. by a source) and cannot be deleted',
      });
      return;
    }
    console.error(`DELETE /hosts/${id} failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const getHostCpuMetricsOperation = {
  summary: 'Per-CPU usage history for a single host',
  description:
    'One series per CPU core (e.g. 4 series for a 4-core host), each core’s busy ratio normalized by core count. A host with no instance set returns an empty series rather than 404/500.',
} satisfies Operation;

export const getHostCpuMetrics = async (req: Request, res: Response) => {
  const { id } = req.params as HostIdParams;
  const { rangeSeconds, stepSeconds } =
    req.query as unknown as HostMetricsRangeQuery;

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

export const getHostMemoryMetricsOperation = {
  summary: 'Memory breakdown history for a single host',
  description:
    'Four series in bytes: used (total − free − buffers − cached), buffers, cached, free. A host with no instance set returns an empty series rather than 404/500.',
} satisfies Operation;

export const getHostMemoryMetrics = async (req: Request, res: Response) => {
  const { id } = req.params as HostIdParams;
  const { rangeSeconds, stepSeconds } =
    req.query as unknown as HostMetricsRangeQuery;

  try {
    const metrics = await hostMetricsService.getHostMemorySeries(id, {
      rangeSeconds,
      stepSeconds,
    });
    if (!metrics) {
      res.status(404).json({ message: 'host not found' });
      return;
    }
    res.status(200).json(metrics);
  } catch (err) {
    console.error(`GET /hosts/${id}/metrics/memory failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const getHostDiskIoMetricsOperation = {
  summary: 'Per-device disk I/O history for a single host',
  description:
    'Three series per real block device (excludes loop/partition devices): read bytes/sec, written bytes/sec, io time (0-1 busy ratio). A host with no instance set returns an empty series rather than 404/500.',
} satisfies Operation;

export const getHostDiskIoMetrics = async (req: Request, res: Response) => {
  const { id } = req.params as HostIdParams;
  const { rangeSeconds, stepSeconds } =
    req.query as unknown as HostMetricsRangeQuery;

  try {
    const metrics = await hostMetricsService.getHostDiskIoSeries(id, {
      rangeSeconds,
      stepSeconds,
    });
    if (!metrics) {
      res.status(404).json({ message: 'host not found' });
      return;
    }
    res.status(200).json(metrics);
  } catch (err) {
    console.error(`GET /hosts/${id}/metrics/disk-io failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const getHostDiskSpaceOperation = {
  summary: 'Current filesystem usage per mountpoint for a single host',
  description:
    'An instant snapshot (not a time range) of size/used/available per mountpoint. A host with no instance set returns an empty list rather than 404/500.',
} satisfies Operation;

export const getHostDiskSpace = async (req: Request, res: Response) => {
  const { id } = req.params as HostIdParams;

  try {
    const diskSpace = await hostMetricsService.getHostDiskSpace(id);
    if (!diskSpace) {
      res.status(404).json({ message: 'host not found' });
      return;
    }
    res.status(200).json(diskSpace);
  } catch (err) {
    console.error(`GET /hosts/${id}/metrics/disk-space failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const getHostTemperatureMetricsOperation = {
  summary: 'Per-sensor temperature history for a single host',
  description:
    'Only ever populated for physical hosts — standalone node-exporter targets expose hwmon sensors; in-cluster k8s nodes (VMs) do not. A host with no instance, or no hwmon sensors, returns an empty series rather than 404/500.',
} satisfies Operation;

export const getHostTemperatureMetrics = async (
  req: Request,
  res: Response,
) => {
  const { id } = req.params as HostIdParams;
  const { rangeSeconds, stepSeconds } =
    req.query as unknown as HostMetricsRangeQuery;

  try {
    const metrics = await hostMetricsService.getHostTemperatureSeries(id, {
      rangeSeconds,
      stepSeconds,
    });
    if (!metrics) {
      res.status(404).json({ message: 'host not found' });
      return;
    }
    res.status(200).json(metrics);
  } catch (err) {
    console.error(`GET /hosts/${id}/metrics/temperature failed:`, err);
    res.status(500).json({ message: 'internal server error' });
  }
};

export const updateHostOperation = {
  summary: 'Update a host',
} satisfies Operation;

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
