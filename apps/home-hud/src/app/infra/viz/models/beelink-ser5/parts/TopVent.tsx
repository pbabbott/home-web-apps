import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { createOctagonBorderGeometry } from '../../../components/chamfered-box';
import { EdgedMesh } from '../../../components/EdgedMesh';
import type { BeelinkSer5Config } from '../config';
import type { BeelinkSer5Materials } from '../materials';
import { ventGridPositions } from './vent-grid';

interface TopVentProps {
  config: BeelinkSer5Config;
  materials: BeelinkSer5Materials;
}

/**
 * Perforated vent covering the whole top face — the real mesh texture runs
 * edge to edge in both reference photos, but the user explicitly asked for
 * the dots to be "contained by a panel," so a thin border is traced just
 * inside the face's own edge. The top face is the chassis's chamfered
 * (rounded-rectangle footprint) face — see parts/Chassis.tsx — so the
 * border follows that same octagon profile, not a plain rectangle (that's
 * SideVents' job now; the two swapped when the chamfer axis did). A dense
 * dot grid rather than individually-outlined holes, same technique as the
 * NAS's TopVent — drei's <Instances> shares one draw call.
 */
export function TopVent({ config, materials }: TopVentProps) {
  const { width, height, depth } = config.chassis.dimensions;
  const { chamfer } = config.chassis;
  const { rows, cols, holeRadius, borderInset } = config.topVent;

  const topY = height / 2 + 0.1;

  const holeGeometry = useMemo(
    () => new THREE.CircleGeometry(holeRadius, 8),
    [holeRadius],
  );

  const borderGeometry = useMemo(
    () => createOctagonBorderGeometry(width, depth, chamfer, borderInset),
    [width, depth, chamfer, borderInset],
  );

  const positions = useMemo(() => {
    return ventGridPositions(width * 0.8, depth * 0.8, cols, rows);
  }, [width, depth, rows, cols]);

  return (
    <group>
      <EdgedMesh
        geometry={borderGeometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edgeDim}
        position={[0, topY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <Instances
        geometry={holeGeometry}
        material={materials.voidActive}
        limit={positions.length}
      >
        {positions.map(([x, z], i) => (
          <Instance
            key={i}
            position={[x, topY + 0.01, z]}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        ))}
      </Instances>
    </group>
  );
}
