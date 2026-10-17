'use client';

import type { Ref } from 'react';
import { ModelViewer, type ModelViewerHandle } from '../components/ModelViewer';
import type { CameraAngle } from '../components/camera-angles';
import { AsustorNas } from '../models/nas/AsustorNas';
import { ASUSTOR_NAS_CONFIG } from '../models/nas/config';
import type { NasModelProps } from '../models/nas/types';

interface NasSceneProps extends NasModelProps {
  initialAngle?: CameraAngle;
  viewerRef?: Ref<ModelViewerHandle>;
}

/**
 * The browser-only half of the NAS viewer: ModelViewer (R3F Canvas) wired
 * up to the AsustorNas model. Lives in its own module, separate from
 * NasViewerClient, purely so NasViewerClient can `next/dynamic` it with
 * `ssr: false` — nothing here should assume it ever runs on the server.
 */
export default function NasScene({
  initialAngle,
  viewerRef,
  ...modelProps
}: NasSceneProps) {
  const { width, height, depth } = ASUSTOR_NAS_CONFIG.dimensions;
  const diagonal = Math.sqrt(width ** 2 + height ** 2 + depth ** 2);
  // 1.5x diagonal leaves margin on every side at the default three-quarter
  // angle — 1.1x was tight enough to clip the feet in some viewport ratios.
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
      <AsustorNas {...modelProps} />
    </ModelViewer>
  );
}
