'use client';

import { Typography } from '@abbottland/fui-components';
import { useDiagramEditor } from '../../DiagramEditorContext';
import { edgeTypeOptions } from '../constants';

export function EdgeTypeControl() {
  const { selectedEdgeIds, selectedEdgeType, onEdgeTypeChange } =
    useDiagramEditor();
  const hasSelection = selectedEdgeIds.length > 0;

  return (
    <div>
      <Typography
        variant="body1"
        component="p"
        className="text-primary-300 mb-2"
      >
        Edge Type
      </Typography>
      <select
        value={selectedEdgeType ?? 'default'}
        onChange={(e) => onEdgeTypeChange(e.target.value)}
        disabled={!hasSelection}
        className="w-full bg-primary-900 border border-primary-600 text-primary-200 rounded px-3 py-2 text-caption !leading-normal outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {edgeTypeOptions.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
