'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Typography } from '@abbottland/fui-components';
import type { HostCpuMetrics } from './lib/homelab-api';
import {
  CHART_AXIS_COLOR,
  CHART_SPLIT_LINE_COLOR,
  CHART_TEXT_COLOR,
  CHART_TOOLTIP_BG,
  CHART_TOOLTIP_BORDER,
  CPU_LINE_PALETTE,
  formatTimeTick,
} from './lib/echarts-theme';

/** Above this many cores, per-core lines become noise: show the host average, with cores as faint context. */
const MAX_LEGIBLE_CORES = 8;

const AVERAGE_COLOR = CPU_LINE_PALETTE[0];
const FAINT_CORE_COLOR = CHART_AXIS_COLOR;

type Point = [number, number];

/** Cores sort numerically ("0,2" before "0,10"), not lexically. */
function compareCores(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

function averageAcrossCores(metrics: HostCpuMetrics): Point[] {
  const sums = new Map<number, { total: number; count: number }>();

  for (const s of metrics.series) {
    for (const p of s.points) {
      const entry = sums.get(p.t) ?? { total: 0, count: 0 };
      entry.total += p.value;
      entry.count += 1;
      sums.set(p.t, entry);
    }
  }

  return [...sums.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, { total, count }]): Point => [t * 1000, total / count]);
}

function buildOption(metrics: HostCpuMetrics): echarts.EChartsOption {
  const cores = [...metrics.series].sort((a, b) => compareCores(a.cpu, b.cpu));
  const collapsed = cores.length > MAX_LEGIBLE_CORES;

  const base = {
    grid: { left: 40, right: 12, top: 28, bottom: 24 },
    textStyle: { color: CHART_TEXT_COLOR, fontSize: 11 },
    xAxis: {
      type: 'time' as const,
      axisLine: { lineStyle: { color: CHART_AXIS_COLOR } },
      axisLabel: { color: CHART_AXIS_COLOR, formatter: formatTimeTick },
      splitNumber: 4,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      min: 0,
      max: 1,
      axisLabel: {
        color: CHART_AXIS_COLOR,
        formatter: (value: number) => `${Math.round(value * 100)}%`,
      },
      splitLine: { lineStyle: { color: CHART_SPLIT_LINE_COLOR } },
    },
  };

  const tooltip = {
    trigger: 'axis' as const,
    backgroundColor: CHART_TOOLTIP_BG,
    borderColor: CHART_TOOLTIP_BORDER,
    textStyle: { color: CHART_TEXT_COLOR },
    valueFormatter: (value: unknown) =>
      `${((value as number) * 100).toFixed(1)}%`,
  };

  if (!collapsed) {
    return {
      ...base,
      color: CPU_LINE_PALETTE,
      legend: {
        top: 0,
        textStyle: { color: CHART_TEXT_COLOR, fontSize: 11 },
        data: cores.map((s) => `cpu${s.cpu}`),
      },
      tooltip,
      series: cores.map((s) => ({
        name: `cpu${s.cpu}`,
        type: 'line',
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 1.5 },
        data: s.points.map((p): Point => [p.t * 1000, p.value]),
      })),
    };
  }

  return {
    ...base,
    legend: {
      top: 0,
      textStyle: { color: CHART_TEXT_COLOR, fontSize: 11 },
      data: [`Average (${cores.length} cores)`],
    },
    // Hovering lists only the average; 16 per-core rows would bury it.
    tooltip: {
      ...tooltip,
      formatter: (params) => {
        const first = (Array.isArray(params) ? params : [params]).find((p) =>
          p.seriesName?.startsWith('Average'),
        );
        if (!first) return '';
        const [t, value] = first.value as Point;
        return `${formatTimeTick(t)}<br/>${first.marker}${first.seriesName}: ${(value * 100).toFixed(1)}%`;
      },
    },
    series: [
      ...cores.map((s) => ({
        name: `cpu${s.cpu}`,
        type: 'line' as const,
        showSymbol: false,
        silent: true,
        lineStyle: { width: 1, color: FAINT_CORE_COLOR, opacity: 0.25 },
        itemStyle: { color: FAINT_CORE_COLOR },
        z: 1,
        data: s.points.map((p): Point => [p.t * 1000, p.value]),
      })),
      {
        name: `Average (${cores.length} cores)`,
        type: 'line' as const,
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 2.5, color: AVERAGE_COLOR },
        itemStyle: { color: AVERAGE_COLOR },
        z: 2,
        data: averageAcrossCores(metrics),
      },
    ],
  };
}

export function CpuChart({ metrics }: { metrics: HostCpuMetrics | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current || !metrics || metrics.series.length === 0) {
      return;
    }

    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;
    chart.setOption(buildOption(metrics));

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [metrics]);

  if (!metrics || metrics.instance === null) {
    return (
      <div className="flex h-20 items-center justify-center border border-dashed border-neutral-600 bg-neutral-900/40">
        <Typography variant="caption" className="text-neutral-500">
          No instance configured for Prometheus scraping
        </Typography>
      </div>
    );
  }

  if (metrics.series.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center border border-dashed border-neutral-600 bg-neutral-900/40">
        <Typography variant="caption" className="text-neutral-500">
          No CPU data from Prometheus yet
        </Typography>
      </div>
    );
  }

  return <div ref={containerRef} className="h-48 w-full" />;
}
