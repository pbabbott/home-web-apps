import { useMemo } from 'react';
import * as THREE from 'three';
import { EdgedMesh } from '../../../components/EdgedMesh';
import type { NasConfig } from '../config';
import type { NasMaterials } from '../materials';

interface FrontFasciaProps {
  config: NasConfig;
  materials: NasMaterials;
}

/**
 * Thin plate mounted on the chassis front face, framing the bay stack.
 * Sits just outside the chassis front wall (config.fascia.depth) so the
 * bay bezels can protrude slightly further still without z-fighting.
 */
export function FrontFascia({ config, materials }: FrontFasciaProps) {
  const { width, height, depth } = config.dimensions;
  const { depth: fasciaDepth } = config.fascia;

  const geometry = useMemo(
    () => new THREE.BoxGeometry(width, height, fasciaDepth),
    [width, height, fasciaDepth],
  );

  const frontZ = depth / 2 + fasciaDepth / 2;

  return (
    <EdgedMesh
      geometry={geometry}
      fillMaterial={materials.void}
      edgeMaterial={materials.edgeDim}
      position={[0, 0, frontZ]}
    />
  );
}
