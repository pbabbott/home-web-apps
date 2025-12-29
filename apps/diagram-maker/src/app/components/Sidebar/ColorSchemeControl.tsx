'use client';

import { Typography } from '@abbottland/fui-components';
import type { NodeColorScheme } from '../nodes/BaseNode';
import { colorSchemeOptions } from './constants';

interface ColorSchemeControlProps {
  selectedColorScheme?: NodeColorScheme;
  onColorSchemeChange: (colorScheme: NodeColorScheme) => void;
  hasSelection: boolean;
}

export function ColorSchemeControl({
  selectedColorScheme,
  onColorSchemeChange,
  hasSelection,
}: ColorSchemeControlProps) {
  return (
    <div>
      <Typography
        variant="body1"
        component="p"
        className="text-primary-300 mb-2"
      >
        Color Scheme
      </Typography>
      <select
        value={selectedColorScheme ?? 'default'}
        onChange={(e) => onColorSchemeChange(e.target.value as NodeColorScheme)}
        disabled={!hasSelection}
        className="w-full bg-primary-900 border border-primary-600 text-primary-200 rounded px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {colorSchemeOptions.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
