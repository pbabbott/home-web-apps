'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Typography } from '@abbottland/fui-components';
import type { PodCpuMetrics } from './lib/homelab-api';
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

// Flat request/limit reference lines, attached to the first series so they
// span the full chart width — not listed in the legend (only series names
// appear there), labeled inline on the line itself instead. Same pattern as
// the hosts temperature chart's warning/critical thresholds.
function buildRequestLimitMarkLine(
  metrics: PodCpuMetrics,
): echarts.LineSeriesOption['markLine'] | undefined {
  const data: NonNullable<echarts.LineSeriesOption['markLine']>['data'] = [];

  if (metrics.requestCores !== null) {
    data.push({
      name: `request ${metrics.requestCores.toFixed(2)}`,
      yAxis: metrics.requestCores,
      lineStyle: { color: REQUEST_LINE_COLOR, type: 'dotted' },
      label: { color: REQUEST_LINE_COLOR },
    });
  }

  if (metrics.limitCores !== null) {
    data.push({
      name: `limit ${metrics.limitCores.toFixed(2)}`,
      yAxis: metrics.limitCores,
      lineStyle: { color: LIMIT_LINE_COLOR, type: 'dotted' },
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

function buildOption(metrics: PodCpuMetrics): echarts.EChartsOption {
  // Auto-scaling the y-axis to the usage data alone can clip the limit
  // line off-chart when the pod is using well under its limit (the common
  // case) — pad the max so both reference lines stay visible. Same fix as
  // the hosts temperature chart's warning/critical padding.
  const dataMax = Math.max(
    0,
    ...metrics.series.flatMap((s) => s.points.map((p) => p.value)),
  );
  const referenceMax = Math.max(
    metrics.requestCores ?? 0,
    metrics.limitCores ?? 0,
  );
  const yAxisMax = Math.max(dataMax, referenceMax) * 1.1;

  return {
    color: POD_CONTAINER_PALETTE,
    grid: { left: 48, right: 12, top: 28, bottom: 24 },
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
      valueFormatter: (value) => `${(value as number).toFixed(3)} cores`,
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: CHART_AXIS_COLOR } },
      // The detail panel is a narrow sidebar (unlike the hosts page's
      // full-width charts), so without an explicit cap echarts' default
      // time-axis ticking crams in far more labels than fit, overlapping
      // into illegible text.
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
        formatter: (value: number) => value.toFixed(2),
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

export function PodCpuChart({ metrics }: { metrics: PodCpuMetrics | null }) {
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
          No CPU data from Prometheus yet
        </Typography>
      </div>
    );
  }

  return <div ref={containerRef} className="h-48 w-full" />;
}
