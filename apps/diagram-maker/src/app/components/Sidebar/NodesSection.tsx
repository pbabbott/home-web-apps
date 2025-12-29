'use client';

import { Card, Typography } from '@abbottland/fui-components';
import { DragEvent } from 'react';
import { nodeTypes } from './constants';

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

      <div className="flex flex-col gap-2">
        {nodeTypes.map(({ type, label, description }) => (
          <Card key={type} color="primary">
            <div
              draggable
              onDragStart={(e) => onDragStart(e, type)}
              className="cursor-grab transition-colors active:cursor-grabbing"
            >
              <Typography variant="h5" component="h5">
                {label}
              </Typography>
              <Typography variant="body1" component="div">
                {description}
              </Typography>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
