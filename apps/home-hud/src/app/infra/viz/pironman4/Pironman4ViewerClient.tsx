'use client';

import dynamic from 'next/dynamic';
import { useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Panel, Typography } from '@abbottland/fui-components';
import { isCameraAngle, type CameraAngle } from '../components/camera-angles';
import type { ModelViewerHandle } from '../components/ModelViewer';

const Pironman4Scene = dynamic(() => import('./Pironman4Scene'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-neutral-950" aria-hidden />,
});

export function Pironman4ViewerClient() {
  const searchParams = useSearchParams();
  const viewerRef = useRef<ModelViewerHandle>(null);

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
    <main className="flex flex-col gap-4 p-6">
      <Typography variant="h1">Pironman4 3D Viewer</Typography>
      <Panel color="default" className="relative h-[70vh] w-full">
        <Pironman4Scene initialAngle={initialAngle} viewerRef={viewerRef} />
        {referenceImageSrc && (
          <img
            src={referenceImageSrc}
            alt={`${referenceAngle} reference`}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-40"
          />
        )}
      </Panel>
    </main>
  );
}
