'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { OutlinedButton, Panel, Typography } from '@abbottland/fui-components';
import { isCameraAngle, type CameraAngle } from '../components/camera-angles';
import type { ModelViewerHandle } from '../components/ModelViewer';
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
        />
        {referenceImageSrc && (
          <img
            src={referenceImageSrc}
            alt={`${referenceAngle} reference`}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-40"
          />
        )}
      </Panel>

      <Panel color="default" className="flex w-full flex-col gap-4 lg:w-80">
        <Typography variant="h5" component="h2">
          Appearance
        </Typography>

        <div className="flex items-center gap-3">
          <input
            type="color"
            value={edgeColor ?? DEFAULT_EDGE_COLOR}
            onChange={(event) => setEdgeColor(event.target.value)}
            className="h-9 w-9 cursor-pointer rounded border border-neutral-700 bg-transparent p-0"
            aria-label="Border and glow color"
          />
          <Typography variant="caption" className="text-neutral-400">
            {(edgeColor ?? DEFAULT_EDGE_COLOR).toUpperCase()}
          </Typography>
        </div>

        <OutlinedButton
          size="small"
          disabled={edgeColor === undefined}
          onClick={() => setEdgeColor(undefined)}
        >
          Reset to default
        </OutlinedButton>
      </Panel>
    </div>
  );
}
