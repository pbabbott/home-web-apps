'use client';

import { Typography } from '@abbottland/fui-components';
import { DragEvent, TouchEvent, useState, useRef, useCallback } from 'react';
import { nodeTypes } from '../constants';
import { NodePreview } from './NodePreview';
import { useDiagramEditor } from '../../DiagramEditorContext';

interface GhostState {
  type: string;
  label: string;
  x: number;
  y: number;
}

export function NodesSection() {
  const { addNodeAtScreenPosition } = useDiagramEditor();
  const [dragGhost, setDragGhost] = useState<GhostState | null>(null);
  const touchNodeRef = useRef<string | null>(null);

  const onDragStart = (event: DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onTouchStart = (
    event: TouchEvent<HTMLDivElement>,
    type: string,
    label: string,
  ) => {
    const touch = event.touches[0];
    touchNodeRef.current = type;
    setDragGhost({ type, label, x: touch.clientX, y: touch.clientY });
  };

  const onTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (!touchNodeRef.current) return;
    const touch = event.touches[0];
    setDragGhost((prev) =>
      prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null,
    );
  }, []);

  const onTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (!touchNodeRef.current) return;
      const touch = event.changedTouches[0];
      addNodeAtScreenPosition(
        touchNodeRef.current,
        touch.clientX,
        touch.clientY,
      );
      touchNodeRef.current = null;
      setDragGhost(null);
    },
    [addNodeAtScreenPosition],
  );

  return (
    <>
      {dragGhost && (
        <div
          className="fixed pointer-events-none z-50 opacity-75"
          style={{
            left: dragGhost.x,
            top: dragGhost.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <NodePreview type={dragGhost.type} label={dragGhost.label} />
        </div>
      )}

      <div>
        <Typography variant="h2" component="h2">
          Nodes
        </Typography>
        <Typography variant="caption" component="p" className="text-neutral-50">
          Drag nodes onto the canvas
        </Typography>
      </div>

      <div className="flex flex-col gap-4 items-center">
        {nodeTypes.map(({ type, label }) => (
          <div
            key={type}
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            onTouchStart={(e) => onTouchStart(e, type, label)}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className="cursor-grab active:cursor-grabbing touch-none"
          >
            <NodePreview type={type} label={label} />
          </div>
        ))}
      </div>
    </>
  );
}
