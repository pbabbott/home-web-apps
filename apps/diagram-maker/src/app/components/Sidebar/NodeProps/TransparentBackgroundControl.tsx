'use client';

import { Typography } from '@abbottland/fui-components';
import { useDiagramEditor } from '../../DiagramEditorContext';

export function TransparentBackgroundControl() {
  const {
    selectedNodeIds,
    selectedTransparentBackground,
    onTransparentBackgroundChange,
  } = useDiagramEditor();
  const hasSelection = selectedNodeIds.length > 0;

  return (
    <div>
      <label
        className={`flex items-center gap-3 cursor-pointer ${!hasSelection ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          type="checkbox"
          checked={selectedTransparentBackground ?? false}
          onChange={(e) => onTransparentBackgroundChange(e.target.checked)}
          disabled={!hasSelection}
          className="w-4 h-4 accent-primary-500"
        />
        <Typography
          variant="body2"
          component="span"
          className="text-primary-200"
        >
          Transparent Background
        </Typography>
      </label>
    </div>
  );
}
