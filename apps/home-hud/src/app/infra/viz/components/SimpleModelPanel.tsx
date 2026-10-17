'use client';

import { useRef, useState, type ComponentType, type Ref } from 'react';
import { Panel } from '@abbottland/fui-components';
import { AppearancePanel } from './AppearancePanel';
import type { CameraAngle } from './camera-angles';
import type { ModelViewerHandle } from './ModelViewer';
import type { ModelStatus } from './resolve-material-colors';
import { useModelViewerParams } from './useModelViewerParams';

export interface SimpleModelSceneProps {
  initialAngle?: CameraAngle;
  viewerRef?: Ref<ModelViewerHandle>;
  edgeColor?: string;
  status?: ModelStatus;
}

interface SimpleModelPanelProps {
  Scene: ComponentType<SimpleModelSceneProps>;
  defaultEdgeColor: string;
  /** Directory under `public/` holding this model's reference `photos/`. */
  photoSlug: string;
}

/**
 * Scene panel + edge-color "Appearance" side panel for models with no
 * model-specific controls. Owns `?angle=`/`?ref=` parsing (via
 * useModelViewerParams), edge-color/status state, and `viewerRef`.
 * Rendered inside a `<TabsContent>` by `../VizViewerClient.tsx`.
 */
export function SimpleModelPanel({
  Scene,
  defaultEdgeColor,
  photoSlug,
}: SimpleModelPanelProps) {
  const viewerRef = useRef<ModelViewerHandle>(null);
  const [edgeColor, setEdgeColor] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<ModelStatus>('online');
  const { initialAngle, referenceAngle, referenceImageSrc } =
    useModelViewerParams(photoSlug);

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <Panel color="default" className="relative h-[70vh] flex-1">
        <Scene
          initialAngle={initialAngle}
          viewerRef={viewerRef}
          edgeColor={edgeColor}
          status={status}
        />
        {referenceImageSrc && (
          <img
            src={referenceImageSrc}
            alt={`${referenceAngle} reference`}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-40"
          />
        )}
      </Panel>

      <AppearancePanel
        edgeColor={edgeColor}
        onEdgeColorChange={setEdgeColor}
        defaultColor={defaultEdgeColor}
        status={status}
        onStatusChange={setStatus}
      />
    </div>
  );
}
