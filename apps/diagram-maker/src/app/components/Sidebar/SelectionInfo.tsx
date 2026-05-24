'use client';

import { Typography } from '@abbottland/fui-components';
import { useDiagramEditor } from '../DiagramEditorContext';

export function SelectionInfo() {
  const { selectedNodeIds, selectedEdgeIds } = useDiagramEditor();
  const hasNodeSelection = selectedNodeIds.length > 0;
  const hasEdgeSelection = selectedEdgeIds.length > 0;
  const hasSelection = hasNodeSelection || hasEdgeSelection;

  return (
    <div>
      <Typography variant="h2" component="h2">
        Props
      </Typography>
      {hasSelection ? (
        <div className="flex flex-col gap-1">
          {hasNodeSelection && (
            <Typography
              variant="body1"
              component="p"
              className="text-neutral-100"
            >
              {selectedNodeIds.length} node
              {selectedNodeIds.length > 1 ? 's' : ''} selected
            </Typography>
          )}
          {hasEdgeSelection && (
            <Typography
              variant="body1"
              component="p"
              className="text-neutral-100"
            >
              {selectedEdgeIds.length} edge
              {selectedEdgeIds.length > 1 ? 's' : ''} selected
            </Typography>
          )}
        </div>
      ) : (
        <Typography
          variant="body1"
          component="p"
          className="text-neutral-500 italic"
        >
          No selection
        </Typography>
      )}
    </div>
  );
}
