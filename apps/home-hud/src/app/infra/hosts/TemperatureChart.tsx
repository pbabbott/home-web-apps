'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Typography } from '@abbottland/fui-components';
import type { HostTemperatureMetrics } from './lib/homelab-api';
import {
  CHART_AXIS_COLOR,
  CHART_SPLIT_LINE_COLOR,
  CHART_TEXT_COLOR,
  CHART_TOOLTIP_BG,
  CHART_TOOLTIP_BORDER,
  formatTimeTick,
  scrollableLegend,
  TEMPERATURE_CRITICAL_CELSIUS,
  TEMPERATURE_CRITICAL_COLOR,
  TEMPERATURE_LINE_PALETTE,
  TEMPERATURE_WARNING_CELSIUS,
  TEMPERATURE_WARNING_COLOR,
} from './lib/echarts-theme';

// Flat warning/critical reference lines, attached to the first series so
// they span the full chart width — not listed in the legend (only series
// names appear there), labeled inline on the line itself instead.
const THRESHOLD_MARK_LINE: echarts.LineSeriesOption['markLine'] = {
  silent: true,
  symbol: 'none',
  animation: false,
  label: { formatter: '{b}', position: 'insideEndTop' },
  data: [
    {
      name: `Warning ${TEMPERATURE_WARNING_CELSIUS}°C`,
      yAxis: TEMPERATURE_WARNING_CELSIUS,
      lineStyle: { color: TEMPERATURE_WARNING_COLOR, type: 'dashed' },
      label: { color: TEMPERATURE_WARNING_COLOR },
    },
    {
      name: `Critical ${TEMPERATURE_CRITICAL_CELSIUS}°C`,
      yAxis: TEMPERATURE_CRITICAL_CELSIUS,
      lineStyle: { color: TEMPERATURE_CRITICAL_COLOR, type: 'dashed' },
      label: { color: TEMPERATURE_CRITICAL_COLOR },
    },
  ],
};

function buildOption(metrics: HostTemperatureMetrics): echarts.EChartsOption {
  // Auto-scaling the y-axis to the data alone can clip the critical line
  // on a cool host (e.g. data tops out at 64°C but critical is 85°C) —
  // pad the max so both threshold lines are always visible.
  const dataMax = Math.max(
    0,
    ...metrics.series.flatMap((s) => s.points.map((p) => p.value)),
  );
  const yAxisMax = Math.max(dataMax, TEMPERATURE_CRITICAL_CELSIUS) + 10;

  return {
    color: TEMPERATURE_LINE_PALETTE,
    grid: { left: 40, right: 12, top: 28, bottom: 24 },
    textStyle: { color: CHART_TEXT_COLOR, fontSize: 11 },
    legend: scrollableLegend(metrics.series.map((s) => s.label)),
    tooltip: {
      trigger: 'axis',
      backgroundColor: CHART_TOOLTIP_BG,
      borderColor: CHART_TOOLTIP_BORDER,
      textStyle: { color: CHART_TEXT_COLOR },
      valueFormatter: (value) => `${(value as number).toFixed(1)}°C`,
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
      max: yAxisMax,
      axisLabel: {
        color: CHART_AXIS_COLOR,
        formatter: (value: number) => `${Math.round(value)}°C`,
      },
      splitLine: { lineStyle: { color: CHART_SPLIT_LINE_COLOR } },
    },
    series: metrics.series.map((s, index) => ({
      name: s.label,
      type: 'line' as const,
      showSymbol: false,
      smooth: true,
      lineStyle: { width: 1.5 },
      data: s.points.map((p) => [p.t * 1000, p.value]),
      ...(index === 0 ? { markLine: THRESHOLD_MARK_LINE } : {}),
    })),
  };
}

export function TemperatureChart({
  metrics,
}: {
  metrics: HostTemperatureMetrics | null;
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
          No temperature sensors reported by this host
        </Typography>
      </div>
    );
  }

  return <div ref={containerRef} className="h-48 w-full" />;
}
