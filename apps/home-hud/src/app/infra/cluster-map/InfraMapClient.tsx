'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Badge,
  type BadgeColor,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  OutlinedButton,
  Panel,
  Scrollbar,
  TiledHexagons,
  type TiledHexagonTile,
  Typography,
} from '@abbottland/fui-components';
import { PanZoomCanvas } from './PanZoomCanvas';
import { PodCpuChart } from './PodCpuChart';
import { PodMemoryChart } from './PodMemoryChart';
import { getPodCpuMetrics, getPodMemoryMetrics } from './lib/actions';
import type {
  GroupDimension,
  MapMetric,
  PodCpuMetrics,
  PodMapItem,
  PodMapResult,
  PodMemoryMetrics,
} from './lib/homelab-api';

const METRIC_OPTIONS: { value: MapMetric; label: string }[] = [
  { value: 'cpu', label: 'CPU' },
  { value: 'memory', label: 'Memory' },
  { value: 'both', label: 'CPU || Memory' },
  { value: 'restarts', label: 'Restarts' },
];

const GROUP_BY_OPTIONS: { value: GroupDimension | null; label: string }[] = [
  { value: null, label: 'None' },
  { value: 'namespace', label: 'Namespace' },
  { value: 'node', label: 'Node' },
  { value: 'workload', label: 'Workload' },
];

const STATUS_BADGE_COLOR: Record<PodMapItem['status'], BadgeColor> = {
  healthy: 'success',
  warning: 'warning',
  error: 'error',
  unknown: 'dark',
};

const MAX_HORIZONTAL_GROUPED = 8;

// Floor for the hex canvas's measured height — keeps it from collapsing to a
// squished sliver on narrow/short mobile viewports.
const MIN_HEX_PANEL_HEIGHT = 480;
// main's own p-8 (2rem) bottom padding, left below the row so it doesn't
// get clipped by the row's measured height.
const MAIN_BOTTOM_PADDING = 32;

function formatPercent(ratio: number | null): string {
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

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Typography variant="small" className="text-neutral-400">
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {value}
      </Typography>
    </div>
  );
}

function itemToTile(
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

function DetailPanel({
  item,
  cpuMetrics,
  memoryMetrics,
  onClose,
}: {
  item: PodMapItem;
  cpuMetrics: PodCpuMetrics | null;
  memoryMetrics: PodMemoryMetrics | null;
  onClose: () => void;
}) {
  // Drives the fui-components `<Scrollbar>` below off this real scrollable
  // div's native scroll state — same wiring as the ScrollbarShowcase story.
  // The div itself keeps native scrolling/keyboard behavior; its own OS
  // scrollbar is just hidden (`scrollbarWidth: none` + the webkit
  // pseudo-element) in favor of the fui-components one rendered beside it.
  // `contentRef` is the fixed-size scroll viewport (its own box never
  // resizes from content growth); `innerRef` wraps the actual content, so a
  // ResizeObserver on it — unlike one on `contentRef` — fires when e.g. the
  // CPU/memory metrics arrive after the pod itself has already rendered.
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [thumbPosition, setThumbPosition] = useState(0);
  const [thumbSize, setThumbSize] = useState(1);
  const [trackHeight, setTrackHeight] = useState(0);

  const syncThumb = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const size =
      scrollHeight > 0 ? Math.min(clientHeight / scrollHeight, 1) : 1;
    const scrollable = scrollHeight - clientHeight;
    const position = scrollable > 0 ? scrollTop / scrollable : 0;
    setThumbSize(size);
    setThumbPosition(position * (1 - size));
    setTrackHeight(clientHeight);
  }, []);

  useEffect(() => {
    const content = contentRef.current;
    const inner = innerRef.current;
    if (!content || !inner) return;
    // No manual initial call: ResizeObserver fires its callback once,
    // asynchronously, right after `observe()` — covering the initial
    // measurement without a synchronous setState in the effect body.
    const resizeObserver = new ResizeObserver(syncThumb);
    resizeObserver.observe(content);
    resizeObserver.observe(inner);
    return () => resizeObserver.disconnect();
  }, [syncThumb]);

  return (
    <Panel color="primary" className="flex h-full min-h-0 flex-col gap-2 p-0">
      <div className="flex items-center justify-between gap-2 px-4 pt-2">
        <Typography variant="h5" component="h2" className="break-all">
          {item.label}
        </Typography>
        <Button size="small" color="neutral" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-row gap-2">
        <div
          ref={contentRef}
          onScroll={syncThumb}
          className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-2 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          <div ref={innerRef} className="flex flex-col gap-4">
            <Badge color={STATUS_BADGE_COLOR[item.status]}>{item.status}</Badge>

            <div className="flex flex-col gap-3">
              <Field label="Namespace" value={item.namespace} />
              <Field label="Node" value={item.node ?? '—'} />
              <Field
                label="Workload"
                value={
                  item.workload
                    ? `${item.workload.kind}/${item.workload.name}`
                    : '—'
                }
              />
              <Field label="Phase" value={item.phase ?? '—'} />
              <Field label="Age" value={item.age ?? '—'} />
              <Field label="Containers" value={item.containers.join(', ')} />
            </div>

            <div className="flex flex-col gap-2 border-t border-neutral-50/20 pt-3">
              <Typography variant="body2">CPU</Typography>
              <div className="flex flex-wrap gap-2">
                <Badge color={STATUS_BADGE_COLOR[item.metrics.cpu.status]}>
                  {formatPercent(item.metrics.cpu.ratio)}
                </Badge>
                <Typography variant="caption" className="text-neutral-400">
                  usage {item.metrics.cpu.usage?.toFixed(3) ?? '-'} · request{' '}
                  {item.metrics.cpu.request?.toFixed(2) ?? '-'} · limit{' '}
                  {item.metrics.cpu.limit?.toFixed(2) ?? '-'}
                </Typography>
              </div>
              <PodCpuChart metrics={cpuMetrics} />
            </div>

            <div className="flex flex-col gap-2">
              <Typography variant="body2">Memory</Typography>
              <div className="flex flex-wrap gap-2">
                <Badge color={STATUS_BADGE_COLOR[item.metrics.memory.status]}>
                  {formatPercent(item.metrics.memory.ratio)}
                </Badge>
                <Typography variant="caption" className="text-neutral-400">
                  usage{' '}
                  {item.metrics.memory.usage
                    ? `${Math.round(item.metrics.memory.usage / 1024 / 1024)}Mi`
                    : '-'}{' '}
                  · request{' '}
                  {item.metrics.memory.request
                    ? `${Math.round(item.metrics.memory.request / 1024 / 1024)}Mi`
                    : '-'}{' '}
                  · limit{' '}
                  {item.metrics.memory.limit
                    ? `${Math.round(item.metrics.memory.limit / 1024 / 1024)}Mi`
                    : '-'}
                </Typography>
              </div>
              <PodMemoryChart metrics={memoryMetrics} />
            </div>

            <div className="flex flex-col gap-2">
              <Typography variant="body2">Restarts</Typography>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={STATUS_BADGE_COLOR[item.metrics.restarts.status]}>
                  {item.metrics.restarts.count}
                </Badge>
                <Typography variant="caption" className="text-neutral-400">
                  worst pod in this map: {item.metrics.restarts.maxCount}{' '}
                  (restarts under 10 are always healthy)
                </Typography>
              </div>
            </div>
          </div>
        </div>

        {trackHeight > 0 && (
          <Scrollbar
            height={trackHeight}
            thumbPosition={thumbPosition}
            thumbSize={thumbSize}
            className="shrink-0"
          />
        )}
      </div>
    </Panel>
  );
}

interface InfraMapClientProps {
  podMap: PodMapResult | null;
  metric: MapMetric;
  groupBy: GroupDimension | null;
}

export function InfraMapClient({
  podMap,
  metric,
  groupBy,
}: InfraMapClientProps) {
  const router = useRouter();
  const [metricMenuOpen, setMetricMenuOpen] = useState(false);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Keyed by pod id rather than a single "current" slot: a stale fetch for
  // a since-deselected pod just writes into an entry nothing reads anymore,
  // instead of racing to overwrite whatever's currently displayed.
  const [cpuMetricsById, setCpuMetricsById] = useState<
    Record<string, PodCpuMetrics | null>
  >({});
  const [memoryMetricsById, setMemoryMetricsById] = useState<
    Record<string, PodMemoryMetrics | null>
  >({});
  const rowRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState<number | null>(null);

  // The row below the filter controls is the one area that should fill the
  // rest of the viewport — measured directly off its own top offset so it's
  // correct regardless of the nav bar's height, instead of layering
  // min-h-screen/flex-1 guesses that leave a few stray px (and a second,
  // page-level scrollbar) above the hex panel's own scrollbar.
  useEffect(() => {
    function updateRowHeight() {
      const top = rowRef.current?.getBoundingClientRect().top;
      if (top === undefined) return;
      setRowHeight(
        Math.max(
          window.innerHeight - top - MAIN_BOTTOM_PADDING,
          MIN_HEX_PANEL_HEIGHT,
        ),
      );
    }

    updateRowHeight();
    window.addEventListener('resize', updateRowHeight);
    return () => window.removeEventListener('resize', updateRowHeight);
  }, []);

  function buildFilterUrl(
    nextMetric: MapMetric,
    nextGroupBy: GroupDimension | null,
  ): string {
    const params = new URLSearchParams({
      metric: nextMetric,
      groupBy: nextGroupBy ?? 'none',
    });
    return `/infra/cluster-map?${params}`;
  }

  function selectMetric(nextMetric: MapMetric) {
    router.push(buildFilterUrl(nextMetric, groupBy));
  }

  function selectGroupBy(nextGroupBy: GroupDimension | null) {
    router.push(buildFilterUrl(metric, nextGroupBy));
  }

  const items = podMap?.items ?? [];
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const selectedItem = selectedId ? (itemsById.get(selectedId) ?? null) : null;

  // Selection lives in local state, not the URL (unlike metric/groupBy), so
  // the charts are fetched client-side via a server action rather than by
  // the page itself.
  function handleSelect(item: PodMapItem) {
    const nextId = selectedId === item.id ? null : item.id;
    setSelectedId(nextId);

    if (nextId === null) return;

    getPodCpuMetrics(item.namespace, item.label)
      .catch((err) => {
        console.error('Failed to load pod CPU metrics from homelab-api:', err);
        return null;
      })
      .then((metrics) => {
        setCpuMetricsById((prev) => ({ ...prev, [nextId]: metrics }));
      });
    getPodMemoryMetrics(item.namespace, item.label)
      .catch((err) => {
        console.error(
          'Failed to load pod memory metrics from homelab-api:',
          err,
        );
        return null;
      })
      .then((metrics) => {
        setMemoryMetricsById((prev) => ({ ...prev, [nextId]: metrics }));
      });
  }

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <Typography variant="h1" component="h1">
        Cluster Map
      </Typography>

      <div className="flex items-center gap-3 self-start">
        <DropdownMenu open={groupMenuOpen} onOpenChange={setGroupMenuOpen}>
          <DropdownMenuTrigger asChild>
            <OutlinedButton size="small">
              Group by:{' '}
              {GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label}
            </OutlinedButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent label="Group by">
            {GROUP_BY_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.label}
                onSelect={() => selectGroupBy(option.value)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu open={metricMenuOpen} onOpenChange={setMetricMenuOpen}>
          <DropdownMenuTrigger asChild>
            <OutlinedButton size="small">
              Metric: {METRIC_OPTIONS.find((o) => o.value === metric)?.label}
            </OutlinedButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent label="Color by">
            {METRIC_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => selectMetric(option.value)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {podMap === null ? (
        <Typography variant="body1" className="text-error-400">
          Failed to load the infra map from homelab-api.
        </Typography>
      ) : items.length === 0 ? (
        <Typography variant="body1">No pods found.</Typography>
      ) : (
        <div
          ref={rowRef}
          className="flex min-h-0 flex-col gap-6 lg:flex-row lg:items-stretch"
          style={rowHeight !== null ? { height: rowHeight } : undefined}
        >
          <PanZoomCanvas resetKey={`${metric}:${groupBy ?? ''}`}>
            {podMap.groups ? (
              <div className="flex flex-wrap items-start gap-8 p-4">
                {podMap.groups.map((group) => (
                  <div key={group.key} className="flex flex-col gap-3">
                    <Typography variant="h5" component="h2">
                      {group.label}{' '}
                      <span className="text-neutral-400">
                        ({group.itemIds.length})
                      </span>
                    </Typography>
                    <TiledHexagons
                      maxHorizontal={MAX_HORIZONTAL_GROUPED}
                      tiles={group.itemIds
                        .map((id) => itemsById.get(id))
                        .filter(
                          (item): item is PodMapItem => item !== undefined,
                        )
                        .map((item) =>
                          itemToTile(item, metric, selectedId, handleSelect),
                        )}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-start gap-8 p-4">
                <div className="flex flex-col gap-3">
                  <Typography variant="h5" component="h2">
                    Cluster{' '}
                    <span className="text-neutral-400">({items.length})</span>
                  </Typography>
                  <TiledHexagons
                    maxHorizontal={MAX_HORIZONTAL_GROUPED}
                    tiles={items.map((item) =>
                      itemToTile(item, metric, selectedId, handleSelect),
                    )}
                  />
                </div>
              </div>
            )}
          </PanZoomCanvas>

          {selectedItem && (
            <div className="min-h-0 w-full shrink-0 lg:w-96">
              <DetailPanel
                // Forces a full unmount/remount per pod instead of an
                // in-place prop diff — see HostsClient's identical `key` on
                // HostDetail for why: without it, the two echarts-backed
                // charts below (each with its own ResizeObserver + canvas)
                // get patched in place on every pod switch, and fast
                // switching can race their dispose/init cycles against
                // React's own DOM patching, surfacing as a stray "Failed to
                // execute 'removeChild'" crash. Keying by pod id makes
                // cleanup (disconnect + dispose) run to completion before
                // the next mount starts.
                key={selectedItem.id}
                item={selectedItem}
                cpuMetrics={cpuMetricsById[selectedItem.id] ?? null}
                memoryMetrics={memoryMetricsById[selectedItem.id] ?? null}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
