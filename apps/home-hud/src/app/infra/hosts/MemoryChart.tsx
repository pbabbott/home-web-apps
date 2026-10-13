'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Typography } from '@abbottland/fui-components';
import type { HostMemoryMetrics, MemoryComponent } from './lib/homelab-api';
import {
  CHART_AXIS_COLOR,
  CHART_SPLIT_LINE_COLOR,
  CHART_TEXT_COLOR,
  CHART_TOOLTIP_BG,
  CHART_TOOLTIP_BORDER,
  MEMORY_STACK_PALETTE,
} from './lib/echarts-theme';
import { formatBytes } from './lib/format-bytes';

const COMPONENT_ORDER: MemoryComponent[] = [
  'used',
  'buffers',
  'cached',
  'free',
];

const COMPONENT_LABEL: Record<MemoryComponent, string> = {
  used: 'Used',
  buffers: 'Buffers',
  cached: 'Cached',
  free: 'Free',
};

function buildOption(metrics: HostMemoryMetrics): echarts.EChartsOption {
  const seriesByComponent = new Map(
    metrics.series.map((s) => [s.component, s]),
  );
  const orderedSeries = COMPONENT_ORDER.map((component) =>
    seriesByComponent.get(component),
  ).filter((s) => s !== undefined);

  return {
    color: MEMORY_STACK_PALETTE,
    grid: { left: 56, right: 12, top: 28, bottom: 24 },
    textStyle: { color: CHART_TEXT_COLOR, fontSize: 11 },
    legend: {
      top: 0,
      textStyle: { color: CHART_TEXT_COLOR, fontSize: 11 },
      data: orderedSeries.map((s) => COMPONENT_LABEL[s.component]),
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: CHART_TOOLTIP_BG,
      borderColor: CHART_TOOLTIP_BORDER,
      textStyle: { color: CHART_TEXT_COLOR },
      valueFormatter: (value) => formatBytes(value as number),
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: CHART_AXIS_COLOR } },
      axisLabel: { color: CHART_AXIS_COLOR },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: {
        color: CHART_AXIS_COLOR,
        formatter: (value: number) => formatBytes(value, 0),
      },
      splitLine: { lineStyle: { color: CHART_SPLIT_LINE_COLOR } },
    },
    series: orderedSeries.map((s) => ({
      name: COMPONENT_LABEL[s.component],
      type: 'line',
      stack: 'memory',
      showSymbol: false,
      smooth: false,
      lineStyle: { width: 1 },
      areaStyle: { opacity: 0.4 },
      data: s.points.map((p) => [p.t * 1000, p.value]),
    })),
  };
}

export function MemoryChart({
  metrics,
}: {
  metrics: HostMemoryMetrics | null;
}) {
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
          No memory data from Prometheus yet
        </Typography>
      </div>
    );
  }

  return <div ref={containerRef} className="h-48 w-full" />;
}
