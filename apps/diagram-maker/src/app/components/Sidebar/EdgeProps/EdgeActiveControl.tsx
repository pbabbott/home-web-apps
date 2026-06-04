'use client';

import { Typography } from '@abbottland/fui-components';
import { useDiagramEditor } from '../../DiagramEditorContext';

export function EdgeActiveControl() {
  const { selectedEdgeIds, selectedEdgeActive, onEdgeActiveChange } =
    useDiagramEditor();
  const hasSelection = selectedEdgeIds.length > 0;

  return (
    <div>
      <Typography
        variant="body1"
        component="p"
        className="text-primary-300 mb-2"
      >
        Spark Effect
      </Typography>
      <label
        className={`flex items-center gap-3 cursor-pointer ${!hasSelection ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          type="checkbox"
          checked={selectedEdgeActive ?? false}
          onChange={(e) => onEdgeActiveChange(e.target.checked)}
          disabled={!hasSelection}
          className="w-4 h-4 accent-primary-500"
        />
        <Typography
          variant="body2"
          component="span"
          className="text-primary-200"
        >
          Active
        </Typography>
      </label>
    </div>
  );
}
