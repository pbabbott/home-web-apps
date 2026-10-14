import { useMemo } from 'react';
import * as THREE from 'three';
import { EdgedMesh } from '../../../components/EdgedMesh';
import type { NasConfig } from '../config';
import type { NasMaterials } from '../materials';

interface FeetProps {
  config: NasConfig;
  materials: NasMaterials;
}

/** Four feet at the bottom corners of the chassis, traced in line art. */
export function Feet({ config, materials }: FeetProps) {
  const { width, height, depth } = config.dimensions;
  const { radius, height: footHeight, inset } = config.feet;

  const geometry = useMemo(
    () => new THREE.CylinderGeometry(radius, radius, footHeight, 16),
    [radius, footHeight],
  );

  const bottomY = -height / 2 - footHeight / 2;
  const halfWidth = width / 2 - inset;
  const halfDepth = depth / 2 - inset;

  const positions: [number, number, number][] = [
    [-halfWidth, bottomY, -halfDepth],
    [halfWidth, bottomY, -halfDepth],
    [-halfWidth, bottomY, halfDepth],
    [halfWidth, bottomY, halfDepth],
  ];

  return (
    <group>
      {positions.map((position, i) => (
        <EdgedMesh
          key={i}
          geometry={geometry}
          fillMaterial={materials.void}
          edgeMaterial={materials.edgeDim}
          position={position}
        />
      ))}
    </group>
  );
}
