'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  useReactFlow,
} from '@xyflow/react';
import { Typography } from '../Typography/Typography';

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
  const { setEdges } = useReactFlow();
  const isReadonly = data?.readonly === true;
  const [isEditing, setIsEditing] = useState(false);
  const [labelValue, setLabelValue] = useState<string>(
    typeof data?.label === 'string' ? data.label : '',
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  // Focus input when editing
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isEditing && !isReadonly) {
        setIsEditing(true);
      }
    },
    [isEditing, isReadonly],
  );

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    setEdges((edges) =>
      edges.map((edge) =>
        edge.id === id
          ? { ...edge, data: { ...edge.data, label: labelValue } }
          : edge,
      ),
    );
  }, [id, labelValue, setEdges]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        // Cmd/Ctrl+Enter to save
        e.preventDefault();
        handleBlur();
      }
      if (e.key === 'Escape') {
        const originalLabel = typeof data?.label === 'string' ? data.label : '';
        setLabelValue(originalLabel);
        setIsEditing(false);
      }
    },
    [handleBlur, data],
  );

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
          {isEditing ? (
            <textarea
              ref={inputRef}
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="bg-primary-900 text-white px-2 py-1 outline-none border border-primary-500 rounded text-sm min-w-[80px] resize-none"
              placeholder="Enter label..."
              rows={1}
              style={{
                minHeight: '2rem',
                height: 'auto',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
            />
          ) : labelValue ? (
            <div
              className={`px-2 bg-primary-800 rounded whitespace-pre-line leading-tight ${
                isReadonly
                  ? 'cursor-default'
                  : 'cursor-text hover:bg-primary-700 transition-colors'
              }`}
              onClick={handleClick}
            >
              <Typography
                variant="caption"
                component="span"
                className="text-neutral-200"
              >
                {labelValue}
              </Typography>
            </div>
          ) : (
            <div
              className={`px-2 py-1 bg-primary-800/50 rounded border border-dashed border-neutral-600 ${
                isReadonly
                  ? 'cursor-default'
                  : 'cursor-text hover:bg-primary-800 transition-colors'
              }`}
              onClick={handleClick}
            >
              {!isReadonly && (
                <Typography
                  variant="caption"
                  component="span"
                  className="text-neutral-400"
                >
                  click to add label
                </Typography>
              )}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
