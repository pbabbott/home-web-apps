import type { TiledHexagonTile } from '@abbottland/fui-components';
import type { MapMetric, PodMapItem } from './homelab-api';

export const MAX_HORIZONTAL_GROUPED = 8;

export function formatPercent(ratio: number | null): string {
  return ratio === null ? 'n/a' : `${Math.round(ratio * 100)}%`;
}

const TILE_LABEL_MAX_LENGTH = 14;

/** Keeps long k8s names (controller/operator pods especially) from overflowing the hex and overlapping neighbors — the full name is still shown in the detail panel. */
function truncateTileLabel(label: string): string {
  return label.length > TILE_LABEL_MAX_LENGTH
    ? `${label.slice(0, TILE_LABEL_MAX_LENGTH - 1)}…`
    : label;
}

/** The ratio that drives a tile's color for the currently selected metric — cpu, memory, or the worse of the two when "both" is selected. */
function primaryRatio(item: PodMapItem, metric: MapMetric): number | null {
  if (metric === 'cpu') return item.metrics.cpu.ratio;
  if (metric === 'memory') return item.metrics.memory.ratio;
  if (metric === 'restarts') return item.metrics.restarts.ratio;

  const { cpu, memory } = item.metrics;
  if (cpu.ratio === null) return memory.ratio;
  if (memory.ratio === null) return cpu.ratio;
  return Math.max(cpu.ratio, memory.ratio);
}

/** Restarts reads better as a raw count than as a percent-of-worst-pod. */
function formatLowerLabel(item: PodMapItem, metric: MapMetric): string {
  if (metric === 'restarts') return `${item.metrics.restarts.count}`;
  return formatPercent(primaryRatio(item, metric));
}

export function itemToTile(
  item: PodMapItem,
  metric: MapMetric,
  selectedId: string | null,
  onSelect: (item: PodMapItem) => void,
): TiledHexagonTile {
  return {
    label: truncateTileLabel(item.workload?.name ?? item.label),
    lowerLabel: formatLowerLabel(item, metric),
    status: item.status,
    active: item.id === selectedId,
    onClick: () => onSelect(item),
  };
}
