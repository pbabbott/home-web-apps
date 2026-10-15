'use client';

import type { Ref } from 'react';
import { ModelViewer, type ModelViewerHandle } from '../components/ModelViewer';
import type { CameraAngle } from '../components/camera-angles';
import { Pironman4 } from '../models/pironman4/Pironman4';
import { PIRONMAN4_CONFIG } from '../models/pironman4/config';
import type { Pironman4ModelProps } from '../models/pironman4/types';

interface Pironman4SceneProps extends Pironman4ModelProps {
  initialAngle?: CameraAngle;
  viewerRef?: Ref<ModelViewerHandle>;
}

/**
 * The browser-only half of the Pironman4 viewer — mirrors NasScene.tsx.
 * Lives in its own module so the Client component can `next/dynamic` it
 * with `ssr: false` (R3F's <Canvas> cannot run server-side).
 */
export default function Pironman4Scene({
  initialAngle,
  viewerRef,
  ...modelProps
}: Pironman4SceneProps) {
  const { width, height, depth } = PIRONMAN4_CONFIG.chassis.dimensions;
  const diagonal = Math.sqrt(width ** 2 + height ** 2 + depth ** 2);
  const cameraRadius = diagonal * 1.5;

  return (
    <ModelViewer
      className="h-full w-full"
      cameraRadius={cameraRadius}
      minDistance={diagonal * 0.6}
      maxDistance={diagonal * 2.5}
      initialAngle={initialAngle}
      idleRotation={initialAngle === undefined}
      lit={false}
      bloom
      viewerRef={viewerRef}
    >
      <Pironman4 {...modelProps} />
    </ModelViewer>
  );
}
