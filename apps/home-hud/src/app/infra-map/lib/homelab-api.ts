const HOMELAB_API_URL = process.env.HOMELAB_API_URL ?? 'http://localhost:4003';

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

export async function getPodMap(
  metric: MapMetric,
  groupBy?: GroupDimension,
): Promise<PodMapResult> {
  const params = new URLSearchParams({ metric });
  if (groupBy) params.set('groupBy', groupBy);

  const res = await fetch(`${HOMELAB_API_URL}/maps/pods?${params}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /maps/pods returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as PodMapResult;
}
