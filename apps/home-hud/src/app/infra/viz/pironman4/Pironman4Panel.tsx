'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Panel } from '@abbottland/fui-components';
import { AppearancePanel } from '../components/AppearancePanel';
import { isCameraAngle, type CameraAngle } from '../components/camera-angles';
import type { ModelViewerHandle } from '../components/ModelViewer';
import type { ModelStatus } from '../components/resolve-material-colors';
import { PIRONMAN4_CONFIG } from '../models/pironman4/config';

const Pironman4Scene = dynamic(() => import('./Pironman4Scene'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-neutral-950" aria-hidden />,
});

const DEFAULT_EDGE_COLOR = PIRONMAN4_CONFIG.materials.edgeHighlight;

/**
 * The Pironman4 viewer's inner content — Scene panel + edge-color
 * "Appearance" side panel. Fully self-contained (own `?angle=`/`?ref=`
 * parsing, own edge-color state, own `viewerRef`). Rendered inside a
 * `<TabsContent>` by `../VizViewerClient.tsx`, which owns the shared
 * `<main>`/H1/tab row.
 */
export function Pironman4Panel() {
  const searchParams = useSearchParams();
  const viewerRef = useRef<ModelViewerHandle>(null);
  const [edgeColor, setEdgeColor] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<ModelStatus>('online');

  const angleParam = searchParams.get('angle');
  const initialAngle: CameraAngle | undefined =
    angleParam && isCameraAngle(angleParam) ? angleParam : undefined;

  const refParam = searchParams.get('ref');
  const referenceAngle: CameraAngle | null =
    refParam && isCameraAngle(refParam) ? refParam : null;

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const referenceImageSrc = referenceAngle
    ? `${basePath}/pironman4/photos/${referenceAngle}.jpg`
    : null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <Panel color="default" className="relative h-[70vh] flex-1">
        <Pironman4Scene
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
        defaultColor={DEFAULT_EDGE_COLOR}
        status={status}
        onStatusChange={setStatus}
      />
    </div>
  );
}
