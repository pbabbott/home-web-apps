import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { EdgedMesh } from '../../../components/EdgedMesh';
import type { BeelinkSer5Config } from '../config';
import type { BeelinkSer5Materials } from '../materials';

interface SideVentsProps {
  config: BeelinkSer5Config;
  materials: BeelinkSer5Materials;
}

/**
 * Mirrored bordered dot-grid vent panels on the LEFT and RIGHT (±X) faces,
 * centered and scaled down from the full face
 * (`sideVent.widthScale`/`heightScale` — read too big at full size, then
 * too small at a uniform half, per explicit corrections, see
 * REFERENCES.md). Unlike the Pironman4 (whose chamfer puts the full
 * octagon on these side faces), this chassis chamfers its TOP/BOTTOM faces
 * instead (see parts/Chassis.tsx) — the sides here are flat rectangles, so
 * the border is a plain inset rect (that's TopVent's job now, the two
 * swapped when the chamfer axis did).
 */
export function SideVents({ config, materials }: SideVentsProps) {
  const { width, height, depth } = config.chassis.dimensions;
  const {
    rows,
    cols,
    holeRadius,
    borderInset,
    widthScale = 1,
    heightScale = 1,
  } = config.sideVent;

  // The panel (border + dot grid) covers `widthScale`/`heightScale` of the
  // face's own depth (its visual "width") x height extent, centered.
  const panelDepth = depth * widthScale;
  const panelHeight = height * heightScale;

  const borderGeometry = useMemo(
    () =>
      new THREE.PlaneGeometry(
        panelDepth - borderInset * 2,
        panelHeight - borderInset * 2,
      ),
    [panelDepth, panelHeight, borderInset],
  );

  const holeGeometry = useMemo(
    () => new THREE.CircleGeometry(holeRadius, 8),
    [holeRadius],
  );

  // Local a = depth axis, b = height axis (matches the border's own
  // depth x height profile before the group rotation below).
  const positions = useMemo(() => {
    const result: [number, number][] = [];
    const marginA = panelDepth * 0.12;
    const marginB = panelHeight * 0.18;
    const usableDepth = panelDepth - marginA * 2;
    const usableHeight = panelHeight - marginB * 2;
    const stepA = usableDepth / cols;
    const stepB = usableHeight / rows;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        result.push([
          -usableDepth / 2 + stepA * (col + 0.5),
          -usableHeight / 2 + stepB * (row + 0.5),
        ]);
      }
    }
    return result;
  }, [panelDepth, panelHeight, rows, cols]);

  const halfWidth = width / 2;

  return (
    <group>
      {([-1, 1] as const).map((side) => (
        <group
          key={side}
          position={[side * halfWidth, 0, 0]}
          rotation={[0, (side * Math.PI) / 2, 0]}
        >
          <EdgedMesh
            geometry={borderGeometry}
            fillMaterial={materials.void}
            edgeMaterial={materials.edgeDim}
            position={[0, 0, 0.01]}
          />
          <Instances
            geometry={holeGeometry}
            material={materials.voidActive}
            limit={positions.length}
          >
            {positions.map(([a, b], i) => (
              <Instance key={i} position={[a, b, 0.02]} />
            ))}
          </Instances>
        </group>
      ))}
    </group>
  );
}
