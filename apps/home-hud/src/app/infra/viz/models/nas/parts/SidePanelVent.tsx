import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import type { NasConfig } from '../config';
import type { NasMaterials } from '../materials';
import { ventGridPositions } from './vent-grid';

interface SidePanelVentProps {
  config: NasConfig;
  materials: NasMaterials;
}

/**
 * Perforation dot grid on both the left and right side panels — same
 * technique as TopVent (one shared <Instances> draw call), facing outward
 * on each side. A rectangular patch biased toward the front edge (not
 * centered front-to-back), per the front reference photo.
 */
export function SidePanelVent({ config, materials }: SidePanelVentProps) {
  const { width, height, depth } = config.dimensions;
  const {
    rows,
    cols,
    holeRadius,
    marginFractionY,
    frontOffsetFraction,
    patchDepthFraction,
  } = config.sideVent;

  const holeGeometry = useMemo(
    () => new THREE.CircleGeometry(holeRadius, 8),
    [holeRadius],
  );

  const positions = useMemo(() => {
    const usableHeight = height * (1 - marginFractionY * 2);
    const patchDepth = depth * patchDepthFraction;
    // +Z is the front of the chassis (see config.ts coordinate system) —
    // the patch's front edge sits frontOffsetFraction*depth back from the
    // chassis' own front face, then spans patchDepth toward the rear.
    const patchFrontZ = depth / 2 - depth * frontOffsetFraction;
    const patchCenterZ = patchFrontZ - patchDepth / 2;
    return ventGridPositions(patchDepth, usableHeight, cols, rows).map(
      ([a, b]): [number, number] => [b, patchCenterZ - a],
    );
  }, [
    height,
    depth,
    marginFractionY,
    frontOffsetFraction,
    patchDepthFraction,
    rows,
    cols,
  ]);

  const leftX = -width / 2 - 0.1;
  const rightX = width / 2 + 0.1;

  return (
    <Instances
      geometry={holeGeometry}
      material={materials.voidActive}
      limit={positions.length * 2}
    >
      {positions.map(([y, z], i) => (
        <Instance
          key={`l-${i}`}
          position={[leftX, y, z]}
          rotation={[0, -Math.PI / 2, 0]}
        />
      ))}
      {positions.map(([y, z], i) => (
        <Instance
          key={`r-${i}`}
          position={[rightX, y, z]}
          rotation={[0, Math.PI / 2, 0]}
        />
      ))}
    </Instances>
  );
}
