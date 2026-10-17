'use client';

import { OutlinedButton, Panel, Typography } from '@abbottland/fui-components';
import type { ModelStatus } from './resolve-material-colors';

const STATUS_OPTIONS: { value: ModelStatus; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'unknown', label: 'Unknown' },
];

interface AppearancePanelProps {
  edgeColor: string | undefined;
  onEdgeColorChange: (color: string | undefined) => void;
  defaultColor: string;
  status: ModelStatus;
  onStatusChange: (status: ModelStatus) => void;
}

/**
 * The shared "Appearance" side panel for every procedural 3D model —
 * replaces what used to be copy-pasted, near-identical JSX in
 * Pironman4Panel.tsx/BeelinkSer5Panel.tsx (and was entirely absent from
 * NasPanel.tsx). A 3-way status selector (plain `OutlinedButton`s, same
 * `border-primary-500` selected-state convention used elsewhere in this
 * codebase — not `Switch`, since this is one 3-valued state, not an
 * independent boolean toggle) plus the custom-color picker + reset,
 * which are disabled whenever `status !== 'online'` since offline/unknown
 * override any custom color regardless of what's picked here.
 */
export function AppearancePanel({
  edgeColor,
  onEdgeColorChange,
  defaultColor,
  status,
  onStatusChange,
}: AppearancePanelProps) {
  const colorControlsDisabled = status !== 'online';

  return (
    <Panel color="default" className="flex w-full flex-col gap-4 lg:w-80">
      <Typography variant="h5" component="h2">
        Appearance
      </Typography>

      <div className="flex gap-2">
        {STATUS_OPTIONS.map((option) => (
          <OutlinedButton
            key={option.value}
            size="small"
            onClick={() => onStatusChange(option.value)}
            className={status === option.value ? 'border-primary-500' : ''}
          >
            {option.label}
          </OutlinedButton>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="color"
          value={edgeColor ?? defaultColor}
          disabled={colorControlsDisabled}
          onChange={(event) => onEdgeColorChange(event.target.value)}
          className="h-9 w-9 cursor-pointer rounded border border-neutral-700 bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Border and glow color"
        />
        <Typography variant="caption" className="text-neutral-400">
          {(edgeColor ?? defaultColor).toUpperCase()}
        </Typography>
      </div>

      <OutlinedButton
        size="small"
        disabled={edgeColor === undefined || colorControlsDisabled}
        onClick={() => onEdgeColorChange(undefined)}
      >
        Reset to default
      </OutlinedButton>
    </Panel>
  );
}
