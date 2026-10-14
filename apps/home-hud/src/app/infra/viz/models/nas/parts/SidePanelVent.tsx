import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import type { NasConfig } from '../config';
import type { NasMaterials } from '../materials';

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
    const stepY = usableHeight / rows;
    const stepZ = patchDepth / cols;
    const result: [number, number][] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        result.push([
          -usableHeight / 2 + stepY * (row + 0.5),
          patchFrontZ - stepZ * (col + 0.5),
        ]);
      }
    }
    return result;
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
