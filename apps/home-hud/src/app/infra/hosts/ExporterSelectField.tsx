'use client';

import type { ExporterType } from './lib/homelab-api';

const EXPORTER_OPTIONS: { value: ExporterType; label: string }[] = [
  { value: 'node_exporter', label: 'node_exporter (Linux)' },
  { value: 'windows_exporter', label: 'windows_exporter (Windows)' },
];

interface ExporterSelectFieldProps {
  value: ExporterType;
  onChange: (value: ExporterType) => void;
}

/**
 * Picker for a host's `exporterType` — decides which Prometheus metric
 * names the metrics panels query. A new exporter only needs an entry in
 * EXPORTER_OPTIONS (plus its backend queries).
 */
export function ExporterSelectField({
  value,
  onChange,
}: ExporterSelectFieldProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ExporterType)}
      className="border border-neutral-300 bg-neutral-600 px-2 py-1.5 text-neutral-50 focus:outline-none focus:ring-0"
    >
      {EXPORTER_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
