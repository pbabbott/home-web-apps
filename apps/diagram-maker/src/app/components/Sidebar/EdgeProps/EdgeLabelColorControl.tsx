'use client';

import { Typography, type EditableEdgeColor } from '@abbottland/fui-components';
import { useDiagramEditor } from '../../DiagramEditorContext';
import { edgeLabelColorOptions } from '../constants';

export function EdgeLabelColorControl() {
  const { selectedEdgeIds, selectedEdgeLabelColor, onEdgeLabelColorChange } =
    useDiagramEditor();
  const hasSelection = selectedEdgeIds.length > 0;

  return (
    <div>
      <Typography
        variant="body1"
        component="p"
        className="text-primary-300 mb-2"
      >
        Label Color
      </Typography>
      <select
        value={selectedEdgeLabelColor ?? 'default'}
        onChange={(e) =>
          onEdgeLabelColorChange(e.target.value as EditableEdgeColor)
        }
        disabled={!hasSelection}
        className="w-full bg-primary-900 border border-primary-600 text-primary-200 rounded px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {edgeLabelColorOptions.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
