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

function buildOption(metrics: HostCpuMetrics): echarts.EChartsOption {
  return {
    color: CPU_LINE_PALETTE,
    grid: { left: 40, right: 12, top: 28, bottom: 24 },
    textStyle: { color: CHART_TEXT_COLOR, fontSize: 11 },
    legend: {
      top: 0,
      textStyle: { color: CHART_TEXT_COLOR, fontSize: 11 },
      data: metrics.series.map((s) => `cpu${s.cpu}`),
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: CHART_TOOLTIP_BG,
      borderColor: CHART_TOOLTIP_BORDER,
      textStyle: { color: CHART_TEXT_COLOR },
      valueFormatter: (value) => `${((value as number) * 100).toFixed(1)}%`,
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: CHART_AXIS_COLOR } },
      axisLabel: { color: CHART_AXIS_COLOR, formatter: formatTimeTick },
      splitNumber: 4,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1,
      axisLabel: {
        color: CHART_AXIS_COLOR,
        formatter: (value: number) => `${Math.round(value * 100)}%`,
      },
      splitLine: { lineStyle: { color: CHART_SPLIT_LINE_COLOR } },
    },
    series: metrics.series.map((s) => ({
      name: `cpu${s.cpu}`,
      type: 'line',
      showSymbol: false,
      smooth: true,
      lineStyle: { width: 1.5 },
      data: s.points.map((p) => [p.t * 1000, p.value]),
    })),
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
