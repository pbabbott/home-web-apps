'use client';

import {
  getSmoothStepPath,
  BaseEdge as XyBaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react';
import { useLabelEdit } from '../EditableEdge/useLabelEdit';
import {
  EdgeLabelContent,
  type EditableEdgeColor,
} from '../EditableEdge/EdgeLabelContent';
import { EdgeSparkEffect } from '../EdgeSparkEffect/EdgeSparkEffect';

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

export interface BaseEdgeProps extends EdgeProps {
  /** false = no label UI rendered (use for DefaultEdge wrapper) */
  editable?: boolean;
}

export function BaseEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  markerStart,
  data,
  editable = true,
}: BaseEdgeProps) {
  const isReadonly = !editable || data?.readonly === true;
  const active = data?.active === true;
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
      <XyBaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{ ...style, cursor: isReadonly ? 'default' : 'text' }}
      />
      {active && <EdgeSparkEffect edgePath={edgePath} id={id} />}
      {editable && (
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
      )}
    </>
  );
}
