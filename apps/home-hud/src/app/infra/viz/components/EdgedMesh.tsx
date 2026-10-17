'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';

export interface EdgedMeshProps {
  geometry: THREE.BufferGeometry;
  /** Near-black unlit fill — occludes correctly but stays visually "void". */
  fillMaterial: THREE.Material;
  /** The glowing line-art outline drawn over every edge of the geometry. */
  edgeMaterial: THREE.LineBasicMaterial;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Degrees between adjacent faces above which an edge is drawn (THREE.EdgesGeometry threshold). */
  thresholdAngle?: number;
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (event: ThreeEvent<PointerEvent>) => void;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}

/**
 * The building block of this model's Tron-style look: every shape renders
 * as a (nearly invisible) solid for correct hidden-line depth-sorting,
 * plus a bright line-art outline traced over its edges. Reused across
 * every part component instead of each one hand-rolling EdgesGeometry.
 */
export function EdgedMesh({
  geometry,
  fillMaterial,
  edgeMaterial,
  position,
  rotation,
  thresholdAngle = 1,
  onPointerOver,
  onPointerOut,
  onClick,
}: EdgedMeshProps) {
  const edgesGeometry = useMemo(
    () => new THREE.EdgesGeometry(geometry, thresholdAngle),
    [geometry, thresholdAngle],
  );

  useEffect(() => () => edgesGeometry.dispose(), [edgesGeometry]);

  return (
    <group position={position} rotation={rotation}>
      <mesh
        geometry={geometry}
        material={fillMaterial}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onClick={onClick}
      />
      <lineSegments geometry={edgesGeometry} material={edgeMaterial} />
    </group>
  );
}
