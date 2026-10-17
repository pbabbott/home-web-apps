'use client';

import { MODEL_REGISTRY } from '../viz/models/registry';

interface ModelSelectFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Picker for a host's `model3d` slug — every option comes from
 * ../viz/models/registry.ts, so a new model only needs a registry entry
 * to show up here, not a change to this component.
 */
export function ModelSelectField({ value, onChange }: ModelSelectFieldProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-neutral-300 bg-neutral-600 px-2 py-1.5 text-neutral-50 focus:outline-none focus:ring-0"
    >
      <option value="">None</option>
      {MODEL_REGISTRY.map((entry) => (
        <option key={entry.slug} value={entry.slug}>
          {entry.label}
        </option>
      ))}
    </select>
  );
}
