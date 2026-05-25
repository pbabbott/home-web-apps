'use client';

import {
  getSmoothStepPath,
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react';
import { useLabelEdit } from './useLabelEdit';
import { EdgeLabelContent, type EditableEdgeColor } from './EdgeLabelContent';

const VALID_COLORS = new Set<EditableEdgeColor>([
  'primary',
  'secondary',
  'default',
]);

function resolveColor(value: unknown): EditableEdgeColor {
  return VALID_COLORS.has(value as EditableEdgeColor)
    ? (value as EditableEdgeColor)
    : 'primary';
}

export function EditableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const isReadonly = data?.readonly === true;
  const color = resolveColor(data?.color);
  const {
    isEditing,
    labelValue,
    setLabelValue,
    inputRef,
    startEditing,
    commitLabel,
    handleKeyDown,
  } = useLabelEdit({ id, data, isReadonly });

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, cursor: isReadonly ? 'default' : 'text' }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 1000,
          }}
          className="nodrag nopan"
        >
          <EdgeLabelContent
            isEditing={isEditing}
            isReadonly={isReadonly}
            labelValue={labelValue}
            setLabelValue={setLabelValue}
            inputRef={inputRef}
            onStartEditing={startEditing}
            onCommit={commitLabel}
            onKeyDown={handleKeyDown}
            color={color}
          />
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
