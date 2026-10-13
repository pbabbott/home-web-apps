import type { V1Pod } from '@kubernetes/client-node';
import { listNodes, listPods } from '../api/kubernetes/kubernetes-client';
import {
  getPodCpuUsage,
  getPodMemoryUsage,
} from '../api/prometheus/prometheus-client';
import { parseCpuQuantity, parseMemoryQuantity } from '../lib/k8s-quantity';

export type HexStatus = 'healthy' | 'warning' | 'error' | 'unknown';
export type MapMetric = 'cpu' | 'memory' | 'both' | 'restarts';
export type GroupDimension = 'namespace' | 'node' | 'workload';

export interface MetricStat {
  usage: number | null;
  request: number | null;
  limit: number | null;
  ratio: number | null;
  status: HexStatus;
}

/** Restarts has no request/limit like cpu/memory — severity is relative to the worst pod in this same response, not an absolute quantity. */
export interface RestartStat {
  count: number;
  maxCount: number;
  ratio: number;
  status: HexStatus;
}

export interface PodMapItem {
  id: string;
  label: string;
  status: HexStatus;
  namespace: string;
  node: string | null;
  workload: { kind: string; name: string } | null;
  phase: string | null;
  restarts: number;
  containers: string[];
  age: string | null;
  metrics: { cpu: MetricStat; memory: MetricStat; restarts: RestartStat };
}

export interface PodMapGroup {
  key: string;
  label: string;
  dimension: GroupDimension;
  itemIds: string[];
}

export interface PodMapResult {
  mapType: 'pods';
  metric: MapMetric;
  items: PodMapItem[];
  groups: PodMapGroup[] | null;
}

// Worst-of severity bands, applied per-metric. "unknown" (no usage data)
// never reports healthier than it is, but also never outranks a known
// warning/error from a sibling metric in `both` mode.
const ERROR_RATIO = 0.9;
const WARNING_RATIO = 0.7;

const STATUS_RANK: Record<HexStatus, number> = {
  unknown: 0,
  healthy: 1,
  warning: 2,
  error: 3,
};

function ratioStatus(ratio: number | null): HexStatus {
  if (ratio === null) return 'unknown';
  if (ratio >= ERROR_RATIO) return 'error';
  if (ratio >= WARNING_RATIO) return 'warning';
  return 'healthy';
}

// A handful of restarts is normal pod churn, not a health signal — only
// pods at/above this floor are even considered for the relative bands
// below. "Most restarts in this response" is deliberately the worst case
// (ratio 1 -> error) rather than an absolute cutoff, since what counts as
// "a lot" varies a great deal by workload.
const RESTART_HEALTHY_FLOOR = 10;
// Looser than the generic cpu/memory bands — restart counts in the wild
// cluster run e.g. 103/123/144/149/157 against a max of 157, and anything
// north of ~0.6 of the worst pod is worth flagging, not just >=0.7.
const RESTART_WARNING_RATIO = 0.6;
const RESTART_ERROR_RATIO = 0.9;

function restartStatus(count: number, maxCount: number): HexStatus {
  if (count < RESTART_HEALTHY_FLOOR || maxCount <= 0) return 'healthy';
  const ratio = count / maxCount;
  if (ratio >= RESTART_ERROR_RATIO) return 'error';
  if (ratio >= RESTART_WARNING_RATIO) return 'warning';
  return 'healthy';
}

function worstStatus(statuses: HexStatus[]): HexStatus {
  return statuses.reduce<HexStatus>(
    (worst, status) =>
      STATUS_RANK[status] > STATUS_RANK[worst] ? status : worst,
    'unknown',
  );
}

function sumContainerQuantities(
  pod: V1Pod,
  field: 'requests' | 'limits',
  resource: 'cpu' | 'memory',
  parse: (quantity: string | undefined | null) => number | null,
): number | null {
  const containers = pod.spec?.containers ?? [];
  let total = 0;
  let found = false;

  for (const container of containers) {
    const parsed = parse(container.resources?.[field]?.[resource]);
    if (parsed !== null) {
      total += parsed;
      found = true;
    }
  }

  return found ? total : null;
}

function resolveWorkload(pod: V1Pod): { kind: string; name: string } | null {
  const owner = pod.metadata?.ownerReferences?.[0];
  if (!owner) return null;

  if (owner.kind === 'ReplicaSet') {
    // Strip the ReplicaSet's trailing hash suffix (e.g.
    // "blog-7495dbf5ff" -> "blog") to recover the Deployment name without
    // an extra apps/v1 lookup.
    const name = owner.name.replace(/-[a-f0-9]{6,10}$/, '');
    return { kind: 'Deployment', name };
  }

  return { kind: owner.kind, name: owner.name };
}

function formatAge(createdAt: Date | undefined): string | null {
  if (!createdAt) return null;

  const ms = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface NodeCapacity {
  cpu: number | null;
  memoryBytes: number | null;
}

async function buildNodeCapacityMap(): Promise<Map<string, NodeCapacity>> {
  const nodes = await listNodes();
  const map = new Map<string, NodeCapacity>();

  for (const node of nodes) {
    const name = node.metadata?.name;
    if (!name) continue;

    const allocatable = node.status?.allocatable ?? node.status?.capacity ?? {};
    map.set(name, {
      cpu: parseCpuQuantity(allocatable.cpu),
      memoryBytes: parseMemoryQuantity(allocatable.memory),
    });
  }

  return map;
}

/**
 * ratio = usage / limit, falling back to usage / request, then to
 * usage / this pod's node's allocatable capacity when neither a limit nor a
 * request is set (common for best-effort pods) — so a pod without declared
 * resources still gets a meaningful severity instead of always "unknown".
 */
function computeMetricStat(
  usage: number | null,
  request: number | null,
  limit: number | null,
  nodeCapacity: number | null,
): MetricStat {
  let ratio: number | null = null;

  if (usage !== null && limit !== null && limit > 0) {
    ratio = usage / limit;
  } else if (usage !== null && request !== null && request > 0) {
    ratio = usage / request;
  } else if (usage !== null && nodeCapacity !== null && nodeCapacity > 0) {
    ratio = usage / nodeCapacity;
  }

  return { usage, request, limit, ratio, status: ratioStatus(ratio) };
}

function buildGroups(
  items: PodMapItem[],
  dimension: GroupDimension,
): PodMapGroup[] {
  const groups = new Map<string, PodMapGroup>();

  for (const item of items) {
    const label =
      dimension === 'namespace'
        ? item.namespace
        : dimension === 'node'
          ? (item.node ?? 'unscheduled')
          : (item.workload?.name ?? 'unowned');

    const key = `${dimension}:${label}`;
    const group = groups.get(key) ?? { key, label, dimension, itemIds: [] };
    group.itemIds.push(item.id);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function countRestarts(pod: V1Pod): number {
  return (pod.status?.containerStatuses ?? []).reduce(
    (sum, containerStatus) => sum + (containerStatus.restartCount ?? 0),
    0,
  );
}

export async function buildPodMap(
  metric: MapMetric,
  groupBy?: GroupDimension,
): Promise<PodMapResult> {
  const [pods, nodeCapacity, cpuUsage, memoryUsage] = await Promise.all([
    listPods(),
    buildNodeCapacityMap(),
    getPodCpuUsage(),
    getPodMemoryUsage(),
  ]);

  // Restart severity is relative to the worst pod in this same response, so
  // the max has to be known before any pod's final status can be computed.
  const maxRestarts = pods.reduce(
    (max, pod) => Math.max(max, countRestarts(pod)),
    0,
  );

  const items: PodMapItem[] = pods.map((pod) => {
    const namespace = pod.metadata?.namespace ?? 'default';
    const name = pod.metadata?.name ?? 'unknown';
    const nodeName = pod.spec?.nodeName ?? null;
    const key = `${namespace}/${name}`;
    const capacity = nodeName ? nodeCapacity.get(nodeName) : undefined;

    const cpuStat = computeMetricStat(
      cpuUsage.get(key) ?? null,
      sumContainerQuantities(pod, 'requests', 'cpu', parseCpuQuantity),
      sumContainerQuantities(pod, 'limits', 'cpu', parseCpuQuantity),
      capacity?.cpu ?? null,
    );
    const memoryStat = computeMetricStat(
      memoryUsage.get(key) ?? null,
      sumContainerQuantities(pod, 'requests', 'memory', parseMemoryQuantity),
      sumContainerQuantities(pod, 'limits', 'memory', parseMemoryQuantity),
      capacity?.memoryBytes ?? null,
    );
    const restarts = countRestarts(pod);
    const restartsStat: RestartStat = {
      count: restarts,
      maxCount: maxRestarts,
      ratio: maxRestarts > 0 ? restarts / maxRestarts : 0,
      status: restartStatus(restarts, maxRestarts),
    };

    const selectedStatuses =
      metric === 'cpu'
        ? [cpuStat.status]
        : metric === 'memory'
          ? [memoryStat.status]
          : metric === 'restarts'
            ? [restartsStat.status]
            : [cpuStat.status, memoryStat.status];

    return {
      id: key,
      label: name,
      status: worstStatus(selectedStatuses),
      namespace,
      node: nodeName,
      workload: resolveWorkload(pod),
      phase: pod.status?.phase ?? null,
      restarts,
      containers: (pod.spec?.containers ?? []).map(
        (container) => container.name,
      ),
      age: formatAge(pod.metadata?.creationTimestamp),
      metrics: { cpu: cpuStat, memory: memoryStat, restarts: restartsStat },
    };
  });

  return {
    mapType: 'pods',
    metric,
    items,
    groups: groupBy ? buildGroups(items, groupBy) : null,
  };
}
