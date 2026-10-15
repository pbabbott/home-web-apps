'use client';

import type { Ref } from 'react';
import { ModelViewer, type ModelViewerHandle } from '../components/ModelViewer';
import type { CameraAngle } from '../components/camera-angles';
import { BeelinkSer5 } from '../models/beelink-ser5/BeelinkSer5';
import { BEELINK_SER5_CONFIG } from '../models/beelink-ser5/config';
import type { BeelinkSer5ModelProps } from '../models/beelink-ser5/types';

interface BeelinkSer5SceneProps extends BeelinkSer5ModelProps {
  initialAngle?: CameraAngle;
  viewerRef?: Ref<ModelViewerHandle>;
}

/**
 * The browser-only half of the Beelink SER5 viewer: ModelViewer (R3F
 * Canvas) wired up to the BeelinkSer5 model. Lives in its own module,
 * separate from BeelinkSer5ViewerClient, purely so the client file can
 * `next/dynamic` it with `ssr: false` — R3F's <Canvas> cannot run
 * server-side.
 */
export default function BeelinkSer5Scene({
  initialAngle,
  viewerRef,
  ...modelProps
}: BeelinkSer5SceneProps) {
  const { width, height, depth } = BEELINK_SER5_CONFIG.chassis.dimensions;
  const diagonal = Math.sqrt(width ** 2 + height ** 2 + depth ** 2);
  const cameraRadius = diagonal * 1.5;

  return (
    <ModelViewer
      className="h-full w-full"
      cameraRadius={cameraRadius}
      minDistance={diagonal * 0.6}
      maxDistance={diagonal * 2.5}
      initialAngle={initialAngle}
      // An explicit ?angle= means the caller wants a fixed, reproducible
      // framing (reference-photo comparison, Playwright capture) — idle
      // auto-rotate would drift the camera away from that angle over time.
      idleRotation={initialAngle === undefined}
      // Tron-style line art: every material is unlit, so the default
      // lighting rig is dead weight here — and a touch of bloom sells the
      // glowing-line look the materials are built for.
      lit={false}
      bloom
      viewerRef={viewerRef}
    >
      <BeelinkSer5 {...modelProps} />
    </ModelViewer>
  );
}
