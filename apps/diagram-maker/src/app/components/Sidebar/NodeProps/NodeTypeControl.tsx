'use client';

import { Typography } from '@abbottland/fui-components';
import { useDiagramEditor } from '../../DiagramEditorContext';
import { nodeTypes } from '../constants';

export function NodeTypeControl() {
  const { selectedNodeIds, selectedNodeType, onNodeTypeChange } =
    useDiagramEditor();
  const hasSelection = selectedNodeIds.length > 0;

  return (
    <div>
      <Typography
        variant="body1"
        component="p"
        className="text-primary-300 mb-2"
      >
        Node Type
      </Typography>
      <select
        value={selectedNodeType ?? 'customDefault'}
        onChange={(e) => onNodeTypeChange(e.target.value)}
        disabled={!hasSelection}
        className="w-full bg-primary-900 border border-primary-600 text-primary-200 rounded px-3 py-2 text-caption !leading-normal outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {nodeTypes.map(({ type, label }) => (
          <option key={type} value={type}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
