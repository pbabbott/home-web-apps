import { useMemo } from 'react';
import { EdgedMesh } from '../../../components/EdgedMesh';
import { createChamferedBoxGeometry } from '../../../components/chamfered-box';
import type { BeelinkSer5Config } from '../config';
import type { BeelinkSer5Materials } from '../materials';

interface ChassisProps {
  config: BeelinkSer5Config;
  materials: BeelinkSer5Materials;
}

/**
 * The low, wide chamfered-corner shell, traced in line art. The chamfer
 * cuts the TOP and BOTTOM faces into a rounded-rectangle footprint (the
 * real unit's lid/base silhouette) — the opposite axis from the
 * Pironman4's tower, which chamfers its ±X (left/right) end faces instead.
 * `createChamferedBoxGeometry` always extrudes along (and puts the full
 * octagon end-caps on) its own local X axis, so this swaps width<->height
 * into the call and rotates the result 90° around Z to put those full
 * octagon faces on world ±Y (top/bottom) instead of ±X. Front/back/left/
 * right then come out as flat rectangles with only a thin corner-chamfer
 * strip at their very top/bottom edges — matches the real photos, where
 * the rounding reads on the top-down silhouette, not as a rounded SIDE
 * face (see REFERENCES.md "Corrections").
 */
export function Chassis({ config, materials }: ChassisProps) {
  const { width, height, depth } = config.chassis.dimensions;
  const { chamfer } = config.chassis;

  const geometry = useMemo(() => {
    const geo = createChamferedBoxGeometry(height, width, depth, chamfer);
    geo.rotateZ(Math.PI / 2);
    return geo;
  }, [width, height, depth, chamfer]);

  return (
    <EdgedMesh
      geometry={geometry}
      fillMaterial={materials.void}
      edgeMaterial={materials.edge}
    />
  );
}
