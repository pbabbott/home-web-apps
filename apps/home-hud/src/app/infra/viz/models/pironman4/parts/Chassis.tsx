import { useMemo } from 'react';
import { EdgedMesh } from '../../../components/EdgedMesh';
import { createChamferedBoxGeometry } from '../../../components/chamfered-box';
import type { Pironman4Config } from '../config';
import type { Pironman4Materials } from '../materials';

interface ChassisProps {
  config: Pironman4Config;
  materials: Pironman4Materials;
}

/** The chamfered-corner aluminum shell, traced in line art. */
export function Chassis({ config, materials }: ChassisProps) {
  const { width, height, depth } = config.chassis.dimensions;
  const { chamfer } = config.chassis;

  const geometry = useMemo(
    () => createChamferedBoxGeometry(width, height, depth, chamfer),
    [width, height, depth, chamfer],
  );

  return (
    <EdgedMesh
      geometry={geometry}
      fillMaterial={materials.void}
      edgeMaterial={materials.edge}
    />
  );
}
