'use client';

import { Typography } from '@abbottland/fui-components';
import { DragEvent } from 'react';
import { nodeTypes } from '../constants';
import { NodePreview } from './NodePreview';

export function NodesSection() {
  const onDragStart = (event: DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <>
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
            className="cursor-grab active:cursor-grabbing"
          >
            <NodePreview type={type} label={label} />
          </div>
        ))}
      </div>
    </>
  );
}
