import { InfraMapClient } from './InfraMapClient';
import {
  getPodMap,
  type GroupDimension,
  type MapMetric,
  type PodMapResult,
} from './lib/homelab-api';

const DEFAULT_METRIC: MapMetric = 'cpu';

const VALID_METRICS: MapMetric[] = ['cpu', 'memory', 'both'];
const VALID_GROUP_BY: GroupDimension[] = ['namespace', 'node', 'workload'];

interface InfraMapPageProps {
  searchParams: Promise<{ metric?: string; groupBy?: string }>;
}

export default async function InfraMapPage({
  searchParams,
}: InfraMapPageProps) {
  const { metric: metricParam, groupBy: groupByParam } = await searchParams;

  const metric: MapMetric = VALID_METRICS.includes(metricParam as MapMetric)
    ? (metricParam as MapMetric)
    : DEFAULT_METRIC;
  const groupBy: GroupDimension | undefined = VALID_GROUP_BY.includes(
    groupByParam as GroupDimension,
  )
    ? (groupByParam as GroupDimension)
    : undefined;

  let podMap: PodMapResult | null = null;

  try {
    podMap = await getPodMap(metric, groupBy);
  } catch (err) {
    console.error('Failed to load pod map from homelab-api:', err);
  }

  return (
    <InfraMapClient podMap={podMap} metric={metric} groupBy={groupBy ?? null} />
  );
}
