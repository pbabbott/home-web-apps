'use client';

import {
  useImperativeHandle,
  useRef,
  type ComponentRef,
  type ReactNode,
  type Ref,
} from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { OutlinedButton, Panel, Typography } from '@abbottland/fui-components';
import { cameraPositionForAngle, type CameraAngle } from './camera-angles';
import { useIdleRotation } from './useIdleRotation';
import { useWebGLAvailable } from './useWebGLAvailable';
import { VIEWER_THEME } from './viewer-theme';

export interface ModelViewerHandle {
  resetView: () => void;
}

export interface ModelViewerProps {
  children: ReactNode;
  /** How far back the default/reset camera sits. Scene units (mm for the NAS model). */
  cameraRadius: number;
  /** Closest/farthest the user can zoom, in the same units as cameraRadius. */
  minDistance: number;
  maxDistance: number;
  /** Named starting angle; defaults to a three-quarter product shot. */
  initialAngle?: CameraAngle;
  idleRotation?: boolean;
  /** Renders the default lighting rig. Turn off for models whose materials are fully unlit (e.g. line-art/Tron-style). */
  lit?: boolean;
  /** Adds a bloom pass so bright/emissive-reading colors glow — the line-art/Tron-style look wants this on. */
  bloom?: boolean;
  className?: string;
  viewerRef?: Ref<ModelViewerHandle>;
}

/**
 * Reusable R3F viewer shell for the homelab 3D viz collection: lighting
 * rig, orbit/zoom/reset controls, idle auto-rotate (paused on interaction,
 * off under prefers-reduced-motion), responsive sizing, and a WebGL
 * fallback. Takes the model as children — it knows nothing about what
 * it's rendering.
 */
export function ModelViewer({
  children,
  cameraRadius,
  minDistance,
  maxDistance,
  initialAngle = 'threeQuarter',
  idleRotation = true,
  lit = true,
  bloom = false,
  className = '',
  viewerRef,
}: ModelViewerProps) {
  const webglAvailable = useWebGLAvailable();
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const idle = useIdleRotation();

  useImperativeHandle(
    viewerRef,
    () => ({
      resetView: () => controlsRef.current?.reset(),
    }),
    [],
  );

  const initialPosition = cameraPositionForAngle(initialAngle, cameraRadius);

  if (!webglAvailable) {
    return (
      <Panel
        color="default"
        className={`flex items-center justify-center ${className}`}
      >
        <Typography variant="body2" className="text-neutral-400">
          WebGL isn&apos;t available in this browser — can&apos;t render the 3D
          view.
        </Typography>
      </Panel>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Canvas
        camera={{ position: initialPosition, fov: 35, near: 1, far: 4000 }}
        gl={{ toneMappingExposure: 1.2 }}
        style={{ backgroundColor: VIEWER_THEME.background }}
      >
        {lit && (
          <>
            <ambientLight intensity={0.9} color={VIEWER_THEME.ambientLight} />
            <hemisphereLight
              intensity={0.35}
              color={VIEWER_THEME.keyLight}
              groundColor={VIEWER_THEME.background}
            />
            {/* Key light follows the initial camera position so the face
                  the user starts looking at is always well-lit, regardless
                  of which named angle initialAngle resolves to. */}
            <directionalLight
              position={initialPosition}
              intensity={1.5}
              color={VIEWER_THEME.keyLight}
            />
            <directionalLight
              position={[
                -cameraRadius,
                cameraRadius * 0.3,
                -cameraRadius * 0.5,
              ]}
              intensity={0.6}
              color={VIEWER_THEME.rimLight}
            />
            <directionalLight
              position={[0, -cameraRadius * 0.5, cameraRadius]}
              intensity={0.3}
              color={VIEWER_THEME.accentLight}
            />
          </>
        )}

        {children}

        {bloom && (
          <EffectComposer>
            <Bloom
              luminanceThreshold={0.15}
              luminanceSmoothing={0.3}
              intensity={0.6}
              mipmapBlur
            />
          </EffectComposer>
        )}

        <OrbitControls
          ref={controlsRef}
          enableDamping
          enablePan={false}
          minDistance={minDistance}
          maxDistance={maxDistance}
          autoRotate={idleRotation && idle.autoRotate}
          autoRotateSpeed={idle.autoRotateSpeed}
          onStart={idle.onInteractionStart}
          onEnd={idle.onInteractionEnd}
        />
      </Canvas>

      <div className="absolute bottom-3 right-3">
        <OutlinedButton
          size="small"
          onClick={() => controlsRef.current?.reset()}
        >
          Reset view
        </OutlinedButton>
      </div>
    </div>
  );
}
