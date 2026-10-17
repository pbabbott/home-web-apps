'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Typography } from '@abbottland/fui-components';
import type {
  DiskIoComponent,
  HostDiskIoMetrics,
  HostDiskIoSeries,
} from './lib/homelab-api';
import {
  CHART_AXIS_COLOR,
  CHART_SPLIT_LINE_COLOR,
  CHART_TEXT_COLOR,
  CHART_TOOLTIP_BG,
  CHART_TOOLTIP_BORDER,
  DISK_DEVICE_PALETTE,
  formatTimeTick,
  scrollableLegend,
} from './lib/echarts-theme';
import { formatBytes } from './lib/format-bytes';

// read/written and ioTime are different units (Bps vs a 0-1 ratio), so they
// get their own y-axis; line style (not color) tells the three components
// of the same device apart, since color already encodes which device.
const LINE_STYLE: Record<DiskIoComponent, 'solid' | 'dashed' | 'dotted'> = {
  read: 'solid',
  written: 'dashed',
  ioTime: 'dotted',
};

const COMPONENT_LABEL: Record<DiskIoComponent, string> = {
  read: 'read',
  written: 'written',
  ioTime: 'io time',
};

function deviceColor(devices: string[], device: string): string {
  const index = devices.indexOf(device);
  return DISK_DEVICE_PALETTE[index % DISK_DEVICE_PALETTE.length];
}

function buildOption(metrics: HostDiskIoMetrics): echarts.EChartsOption {
  const devices = [...new Set(metrics.series.map((s) => s.device))].sort();

  const throughputSeries = metrics.series.filter(
    (s): s is HostDiskIoSeries & { component: 'read' | 'written' } =>
      s.component === 'read' || s.component === 'written',
  );
  const ioTimeSeries = metrics.series.filter((s) => s.component === 'ioTime');

  return {
    color: devices.map((d) => deviceColor(devices, d)),
    grid: { left: 56, right: 48, top: 56, bottom: 24 },
    textStyle: { color: CHART_TEXT_COLOR, fontSize: 11 },
    legend: scrollableLegend(
      metrics.series.map((s) => `${s.device} ${COMPONENT_LABEL[s.component]}`),
    ),
    tooltip: {
      trigger: 'axis',
      backgroundColor: CHART_TOOLTIP_BG,
      borderColor: CHART_TOOLTIP_BORDER,
      textStyle: { color: CHART_TEXT_COLOR },
      valueFormatter: (value) => `${formatBytes(value as number)}/s`,
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: CHART_AXIS_COLOR } },
      axisLabel: { color: CHART_AXIS_COLOR, formatter: formatTimeTick },
      splitNumber: 4,
      splitLine: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        min: 0,
        axisLabel: {
          color: CHART_AXIS_COLOR,
          formatter: (value: number) => `${formatBytes(value, 0)}/s`,
        },
        splitLine: { lineStyle: { color: CHART_SPLIT_LINE_COLOR } },
      },
      {
        type: 'value',
        min: 0,
        max: 1,
        axisLabel: {
          color: CHART_AXIS_COLOR,
          formatter: (value: number) => `${Math.round(value * 100)}%`,
        },
        splitLine: { show: false },
      },
    ],
    series: [
      ...throughputSeries.map((s) => ({
        name: `${s.device} ${COMPONENT_LABEL[s.component]}`,
        type: 'line' as const,
        yAxisIndex: 0,
        showSymbol: false,
        smooth: true,
        color: deviceColor(devices, s.device),
        lineStyle: { width: 1.5, type: LINE_STYLE[s.component] },
        data: s.points.map((p) => [p.t * 1000, p.value]),
      })),
      ...ioTimeSeries.map((s) => ({
        name: `${s.device} ${COMPONENT_LABEL[s.component]}`,
        type: 'line' as const,
        yAxisIndex: 1,
        showSymbol: false,
        smooth: true,
        color: deviceColor(devices, s.device),
        lineStyle: { width: 1, type: LINE_STYLE[s.component] },
        data: s.points.map((p) => [p.t * 1000, p.value]),
      })),
    ],
  };
}

export function DiskIoChart({
  metrics,
}: {
  metrics: HostDiskIoMetrics | null;
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
          No disk I/O data from Prometheus yet
        </Typography>
      </div>
    );
  }

  return <div ref={containerRef} className="h-60 w-full" />;
}
