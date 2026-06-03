'use client';

import { useReactFlow } from '@xyflow/react';
import {
  EnterFullScreenIcon,
  ExitFullScreenIcon,
  PlusIcon,
  MinusIcon,
  TargetIcon,
} from '@radix-ui/react-icons';
import { Button } from '../Button/Button';

export interface DiagramControlsProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function DiagramControls({
  isFullscreen,
  onToggleFullscreen,
}: DiagramControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
      {onToggleFullscreen && (
        <Button
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
          color="neutral"
          variant="contained"
          className="p-1.5"
        >
          {isFullscreen ? (
            <ExitFullScreenIcon width={16} height={16} />
          ) : (
            <EnterFullScreenIcon width={16} height={16} />
          )}
        </Button>
      )}
      <Button
        onClick={() => zoomIn()}
        aria-label="Zoom in"
        color="neutral"
        variant="contained"
        className="p-1.5"
      >
        <PlusIcon width={16} height={16} />
      </Button>
      <Button
        onClick={() => zoomOut()}
        aria-label="Zoom out"
        color="neutral"
        variant="contained"
        className="p-1.5"
      >
        <MinusIcon width={16} height={16} />
      </Button>
      <Button
        onClick={() => fitView({ padding: 0.2 })}
        aria-label="Fit view"
        color="neutral"
        variant="contained"
        className="p-1.5"
      >
        <TargetIcon width={16} height={16} />
      </Button>
    </div>
  );
}
