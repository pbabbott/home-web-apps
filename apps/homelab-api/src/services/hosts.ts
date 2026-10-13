import {
  createHost as createHostRow,
  deleteHost as deleteHostRow,
  getHostById,
  listHosts as listHostRows,
  updateHost as updateHostRow,
  type CreateHostInput,
  type Host,
  type HostType,
  type UpdateHostInput,
} from '@abbottland/homelab-db';
import { db } from '../db';
import {
  getNodeCpuUsage,
  getNodeUp,
} from '../api/prometheus/prometheus-client';

export type HostStatus = 'online' | 'offline' | 'unknown';

export interface HostWithMetrics extends Host {
  status: HostStatus;
  cpuUsageRatio: number | null;
}

function resolveStatus(up: number | undefined): HostStatus {
  if (up === undefined) return 'unknown';
  return up >= 1 ? 'online' : 'offline';
}

/**
 * Enriches DB-backed host rows with live Prometheus data, keyed by
 * instance. Prometheus is best-effort: a host with no instance set, or
 * whose node-exporter data hasn't reached Prometheus, still returns —
 * just with "unknown" status and null cpu — so a Prometheus outage never
 * takes down the hosts list itself (mirrors pod-map.ts's enrich-if-
 * available approach).
 */
async function enrichHosts(hosts: Host[]): Promise<HostWithMetrics[]> {
  const [upByInstance, cpuByInstance] = await Promise.all([
    getNodeUp(),
    getNodeCpuUsage(),
  ]);

  return hosts.map((host) => ({
    ...host,
    status: host.instance
      ? resolveStatus(upByInstance.get(host.instance))
      : 'unknown',
    cpuUsageRatio: host.instance
      ? (cpuByInstance.get(host.instance) ?? null)
      : null,
  }));
}

export async function listHosts(
  hostType?: HostType,
): Promise<HostWithMetrics[]> {
  const hosts = await listHostRows(db, hostType);
  return enrichHosts(hosts);
}

export async function getHost(
  id: string,
): Promise<HostWithMetrics | undefined> {
  const host = await getHostById(db, id);
  if (!host) return undefined;

  const [enriched] = await enrichHosts([host]);
  return enriched;
}

export async function createHost(input: CreateHostInput): Promise<Host> {
  return createHostRow(db, input);
}

export async function updateHost(
  id: string,
  input: UpdateHostInput,
): Promise<HostWithMetrics | undefined> {
  const host = await updateHostRow(db, id, input);
  if (!host) return undefined;

  const [enriched] = await enrichHosts([host]);
  return enriched;
}

export async function deleteHost(id: string): Promise<Host | undefined> {
  return deleteHostRow(db, id);
}
