import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import type { NasConfig } from '../config';
import type { NasMaterials } from '../materials';

interface TopVentProps {
  config: NasConfig;
  materials: NasMaterials;
}

/**
 * Perforated vent covering roughly the rear 2/3 of the top panel — matches
 * the real top reference photo (public/nas-asustor/photos/top.jpg), which
 * shows the front portion of the top panel left solid before the venting
 * starts. A dense dot grid rather than individually-outlined holes (224
 * holes with per-hole line art would add draw calls for little visual
 * gain at this scale) — drei's <Instances> shares one draw call.
 */
export function TopVent({ config, materials }: TopVentProps) {
  const { width, height, depth } = config.dimensions;
  const { rows, cols, holeRadius, solidFrontFraction } = config.topVent;

  const holeGeometry = useMemo(
    () => new THREE.CircleGeometry(holeRadius, 8),
    [holeRadius],
  );

  const topY = height / 2 + 0.1;
  const ventDepth = depth * (1 - solidFrontFraction);
  const ventCenterZ = -depth / 2 + ventDepth / 2;

  const positions = useMemo(() => {
    const result: [number, number][] = [];
    const marginX = width * 0.08;
    const usableWidth = width - marginX * 2;
    const stepX = usableWidth / cols;
    const stepZ = ventDepth / rows;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        result.push([
          -usableWidth / 2 + stepX * (col + 0.5),
          -ventDepth / 2 + stepZ * (row + 0.5),
        ]);
      }
    }
    return result;
  }, [width, ventDepth, rows, cols]);

  return (
    <Instances
      geometry={holeGeometry}
      material={materials.voidActive}
      limit={positions.length}
    >
      {positions.map(([x, z], i) => (
        <Instance
          key={i}
          position={[x, topY, ventCenterZ + z]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      ))}
    </Instances>
  );
}
