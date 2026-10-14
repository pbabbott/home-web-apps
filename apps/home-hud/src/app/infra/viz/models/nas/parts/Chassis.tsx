import { useMemo } from 'react';
import * as THREE from 'three';
import { EdgedMesh } from '../../../components/EdgedMesh';
import type { NasConfig } from '../config';
import type { NasMaterials } from '../materials';

interface ChassisProps {
  config: NasConfig;
  materials: NasMaterials;
}

/** Main enclosure: a void box traced in line art along every edge. */
export function Chassis({ config, materials }: ChassisProps) {
  const { width, height, depth } = config.dimensions;

  const geometry = useMemo(
    () => new THREE.BoxGeometry(width, height, depth),
    [width, height, depth],
  );

  return (
    <EdgedMesh
      geometry={geometry}
      fillMaterial={materials.void}
      edgeMaterial={materials.edge}
    />
  );
}
