'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Badge,
  type BadgeColor,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  OutlinedButton,
  Panel,
  Scrollbar,
  TiledHexagons,
  type TiledHexagonTile,
  TransparentPanel,
  Typography,
} from '@abbottland/fui-components';
import type {
  GroupDimension,
  MapMetric,
  PodMapItem,
  PodMapResult,
} from './lib/homelab-api';

const METRIC_OPTIONS: { value: MapMetric; label: string }[] = [
  { value: 'cpu', label: 'CPU' },
  { value: 'memory', label: 'Memory' },
  { value: 'both', label: 'CPU || Memory' },
];

const GROUP_BY_OPTIONS: { value: GroupDimension | null; label: string }[] = [
  { value: null, label: 'None' },
  { value: 'namespace', label: 'Namespace' },
  { value: 'node', label: 'Node' },
  { value: 'workload', label: 'Workload' },
];

const STATUS_BADGE_COLOR: Record<PodMapItem['status'], BadgeColor> = {
  healthy: 'secondary',
  warning: 'warning',
  error: 'error',
  unknown: 'dark',
};

const MAX_HORIZONTAL_UNGROUPED = 12;
const MAX_HORIZONTAL_GROUPED = 8;

const MIN_HEX_PANEL_HEIGHT = 320;
// TransparentPanel's own py-2 (0.5rem top + bottom) — subtracted so the
// content pane fits flush inside the padded box instead of overflowing it.
const PANEL_VERTICAL_PADDING = 16;
// main's own p-8 (2rem) bottom padding, left below the row so it doesn't
// get clipped by the row's measured height.
const MAIN_BOTTOM_PADDING = 32;

// Browser-default scrollbar hidden on the content pane so only the fui
// Scrollbar (synced to the same scroll state below) is visible.
const HIDE_NATIVE_SCROLLBAR = `
.infra-map-hex-scroll::-webkit-scrollbar { display: none; }
`;

/** Dark panel for the hex grid that fills whatever height its flex row gives it (full remaining viewport height) — content scrolls internally using the fui Scrollbar in place of the native one. */
function ScrollableHexPanel({
  children,
  resetKey,
}: {
  children: ReactNode;
  resetKey: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(MIN_HEX_PANEL_HEIGHT);
  const [thumbPosition, setThumbPosition] = useState(0);
  const [thumbSize, setThumbSize] = useState(1);

  const syncThumb = () => {
    const el = contentRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const size =
      clientHeight > 0 ? Math.min(clientHeight / scrollHeight, 1) : 1;
    const scrollable = scrollHeight - clientHeight;
    const position = scrollable > 0 ? scrollTop / scrollable : 0;
    setThumbSize(size);
    setThumbPosition(position * (1 - size));
  };

  // The panel's actual height comes from its flex row (fills remaining
  // viewport height), so measure it live rather than assuming a fixed
  // value — a window resize or sidebar reflow changes it too.
  useEffect(() => {
    const panelEl = panelRef.current;
    if (!panelEl) return;

    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height) setPanelHeight(Math.max(height, MIN_HEX_PANEL_HEIGHT));
    });
    observer.observe(panelEl);

    return () => observer.disconnect();
  }, []);

  // Content height changes whenever the metric/groupBy selection (or the
  // data itself) changes, so re-measure instead of trusting stale state.
  // Deferred a frame so layout has settled before measuring (and so the
  // setState call isn't synchronous within the effect body).
  useEffect(() => {
    const raf = requestAnimationFrame(syncThumb);
    return () => cancelAnimationFrame(raf);
  }, [resetKey, panelHeight]);

  function handleThumbPositionChange(nextPosition: number) {
    const el = contentRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 0) return;

    const scrollRatio = thumbSize < 1 ? nextPosition / (1 - thumbSize) : 0;
    el.scrollTop = scrollRatio * scrollable;
    syncThumb();
  }

  function handlePageStep(direction: 'up' | 'down') {
    const el = contentRef.current;
    if (!el) return;
    el.scrollTop += direction === 'down' ? el.clientHeight : -el.clientHeight;
    syncThumb();
  }

  const contentHeight = Math.max(
    panelHeight - PANEL_VERTICAL_PADDING,
    MIN_HEX_PANEL_HEIGHT - PANEL_VERTICAL_PADDING,
  );

  return (
    <div ref={panelRef} className="flex min-h-0 min-w-0 flex-1 self-stretch">
      <TransparentPanel
        color="dark"
        className="flex h-full min-h-0 min-w-0 flex-1 flex-row gap-2"
      >
        <style>{HIDE_NATIVE_SCROLLBAR}</style>
        <div
          ref={contentRef}
          onScroll={syncThumb}
          className="infra-map-hex-scroll min-w-0 flex-1 overflow-auto"
          style={{ height: contentHeight, scrollbarWidth: 'none' }}
        >
          {children}
        </div>
        <Scrollbar
          height={contentHeight}
          thumbPosition={thumbPosition}
          thumbSize={thumbSize}
          onThumbPositionChange={handleThumbPositionChange}
          onPageStep={handlePageStep}
        />
      </TransparentPanel>
    </div>
  );
}

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

  const { cpu, memory } = item.metrics;
  if (cpu.ratio === null) return memory.ratio;
  if (memory.ratio === null) return cpu.ratio;
  return Math.max(cpu.ratio, memory.ratio);
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
    lowerLabel: formatPercent(primaryRatio(item, metric)),
    status: item.status,
    active: item.id === selectedId,
    onClick: () => onSelect(item),
  };
}

function DetailPanel({ item }: { item: PodMapItem | null }) {
  if (!item) {
    return (
      <Panel color="default" className="flex h-full flex-col gap-2">
        <Typography variant="h5" component="h2">
          Pod Detail
        </Typography>
        <Typography variant="body2" className="text-neutral-400">
          Select a hexagon to see details.
        </Typography>
      </Panel>
    );
  }

  return (
    <Panel color="default" className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Typography variant="h5" component="h2" className="break-all">
          {item.label}
        </Typography>
        <Badge color={STATUS_BADGE_COLOR[item.status]}>{item.status}</Badge>
      </div>

      <div className="flex flex-col gap-3">
        <Field label="Namespace" value={item.namespace} />
        <Field label="Node" value={item.node ?? '—'} />
        <Field
          label="Workload"
          value={
            item.workload ? `${item.workload.kind}/${item.workload.name}` : '—'
          }
        />
        <Field label="Phase" value={item.phase ?? '—'} />
        <Field label="Restarts" value={item.restarts} />
        <Field label="Age" value={item.age ?? '—'} />
        <Field label="Containers" value={item.containers.join(', ')} />
      </div>

      <div className="flex flex-col gap-2 border-t border-neutral-50/20 pt-3">
        <Typography variant="small" className="text-neutral-400">
          CPU
        </Typography>
        <div className="flex flex-wrap gap-2">
          <Badge color={STATUS_BADGE_COLOR[item.metrics.cpu.status]}>
            {formatPercent(item.metrics.cpu.ratio)}
          </Badge>
          <Typography variant="caption" className="text-neutral-400">
            usage {item.metrics.cpu.usage?.toFixed(3) ?? '—'} · request{' '}
            {item.metrics.cpu.request?.toFixed(2) ?? '—'} · limit{' '}
            {item.metrics.cpu.limit?.toFixed(2) ?? '—'}
          </Typography>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Typography variant="small" className="text-neutral-400">
          Memory
        </Typography>
        <div className="flex flex-wrap gap-2">
          <Badge color={STATUS_BADGE_COLOR[item.metrics.memory.status]}>
            {formatPercent(item.metrics.memory.ratio)}
          </Badge>
          <Typography variant="caption" className="text-neutral-400">
            usage{' '}
            {item.metrics.memory.usage
              ? `${Math.round(item.metrics.memory.usage / 1024 / 1024)}Mi`
              : '—'}{' '}
            · request{' '}
            {item.metrics.memory.request
              ? `${Math.round(item.metrics.memory.request / 1024 / 1024)}Mi`
              : '—'}{' '}
            · limit{' '}
            {item.metrics.memory.limit
              ? `${Math.round(item.metrics.memory.limit / 1024 / 1024)}Mi`
              : '—'}
          </Typography>
        </div>
      </div>
    </Panel>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge color="secondary">Healthy</Badge>
      <Badge color="warning">Warning</Badge>
      <Badge color="error">Error</Badge>
      <Badge color="dark">Unknown</Badge>
    </div>
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
    const params = new URLSearchParams({ metric: nextMetric });
    if (nextGroupBy) params.set('groupBy', nextGroupBy);
    return `/infra-map?${params}`;
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

  function handleSelect(item: PodMapItem) {
    setSelectedId((current) => (current === item.id ? null : item.id));
  }

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <div className="flex items-center justify-between gap-4">
        <Typography variant="h1" component="h1">
          Infra Map
        </Typography>
        <Legend />
      </div>

      <div className="flex items-center gap-3 self-start">
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
          <ScrollableHexPanel resetKey={`${metric}:${groupBy ?? ''}`}>
            <div className="flex flex-col gap-8">
              {podMap.groups ? (
                podMap.groups.map((group) => (
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
                ))
              ) : (
                <TiledHexagons
                  maxHorizontal={MAX_HORIZONTAL_UNGROUPED}
                  tiles={items.map((item) =>
                    itemToTile(item, metric, selectedId, handleSelect),
                  )}
                />
              )}
            </div>
          </ScrollableHexPanel>

          <div className="w-full shrink-0 lg:w-96">
            <DetailPanel item={selectedItem} />
          </div>
        </div>
      )}
    </main>
  );
}
