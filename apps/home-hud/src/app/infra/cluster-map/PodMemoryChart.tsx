'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Typography } from '@abbottland/fui-components';
import type { PodMemoryMetrics } from './lib/homelab-api';
import {
  CHART_AXIS_COLOR,
  CHART_SPLIT_LINE_COLOR,
  CHART_TEXT_COLOR,
  CHART_TOOLTIP_BG,
  CHART_TOOLTIP_BORDER,
  formatTimeTick,
  LIMIT_LINE_COLOR,
  POD_CONTAINER_PALETTE,
  REQUEST_LINE_COLOR,
} from './lib/echarts-theme';
import { formatBytes } from './lib/format-bytes';

// Same request/limit reference-line pattern as PodCpuChart.
function buildRequestLimitMarkLine(
  metrics: PodMemoryMetrics,
): echarts.LineSeriesOption['markLine'] | undefined {
  const data: NonNullable<echarts.LineSeriesOption['markLine']>['data'] = [];

  if (metrics.requestBytes !== null) {
    data.push({
      name: `request ${formatBytes(metrics.requestBytes, 0)}`,
      yAxis: metrics.requestBytes,
      lineStyle: { color: REQUEST_LINE_COLOR, type: 'dashed' },
      label: { color: REQUEST_LINE_COLOR },
    });
  }

  if (metrics.limitBytes !== null) {
    data.push({
      name: `limit ${formatBytes(metrics.limitBytes, 0)}`,
      yAxis: metrics.limitBytes,
      lineStyle: { color: LIMIT_LINE_COLOR, type: 'dashed' },
      label: { color: LIMIT_LINE_COLOR },
    });
  }

  if (data.length === 0) return undefined;

  return {
    silent: true,
    symbol: 'none',
    animation: false,
    label: { formatter: '{b}', position: 'insideEndTop' },
    data,
  };
}

function buildOption(metrics: PodMemoryMetrics): echarts.EChartsOption {
  // Auto-scaling the y-axis to the usage data alone can clip the limit
  // line off-chart when the pod is using well under its limit (the common
  // case) — pad the max so both reference lines stay visible. Same fix as
  // the hosts temperature chart's warning/critical padding.
  const dataMax = Math.max(
    0,
    ...metrics.series.flatMap((s) => s.points.map((p) => p.value)),
  );
  const referenceMax = Math.max(
    metrics.requestBytes ?? 0,
    metrics.limitBytes ?? 0,
  );
  const yAxisMax = Math.max(dataMax, referenceMax) * 1.1;

  return {
    color: POD_CONTAINER_PALETTE,
    grid: { left: 56, right: 12, top: 28, bottom: 24 },
    textStyle: { color: CHART_TEXT_COLOR, fontSize: 11 },
    legend: {
      top: 0,
      textStyle: { color: CHART_TEXT_COLOR, fontSize: 11 },
      data: metrics.series.map((s) => s.container),
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
      // See PodCpuChart's identical xAxis config for why this is capped —
      // same narrow-sidebar overlap problem.
      axisLabel: {
        color: CHART_AXIS_COLOR,
        hideOverlap: true,
        formatter: formatTimeTick,
      },
      splitNumber: 4,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: yAxisMax > 0 ? yAxisMax : undefined,
      axisLabel: {
        color: CHART_AXIS_COLOR,
        formatter: (value: number) => formatBytes(value, 0),
      },
      splitLine: { lineStyle: { color: CHART_SPLIT_LINE_COLOR } },
    },
    series: metrics.series.map((s, index) => ({
      name: s.container,
      type: 'line' as const,
      showSymbol: false,
      smooth: true,
      lineStyle: { width: 1.5 },
      data: s.points.map((p) => [p.t * 1000, p.value]),
      ...(index === 0 ? { markLine: buildRequestLimitMarkLine(metrics) } : {}),
    })),
  };
}

export function PodMemoryChart({
  metrics,
}: {
  metrics: PodMemoryMetrics | null;
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

  if (!metrics || metrics.series.length === 0) {
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
