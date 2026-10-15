import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { createOctagonBorderGeometry } from '../../../components/chamfered-box';
import { EdgedMesh } from '../../../components/EdgedMesh';
import type { Pironman4Config } from '../config';
import type { Pironman4Materials } from '../materials';

interface FanGrilleProps {
  config: Pironman4Config;
  materials: Pironman4Materials;
}

/**
 * Hex-honeycomb vent for the tower cooler fan intake, modeled on the LEFT
 * and RIGHT (±X) faces — moved off the top per explicit correction (see
 * REFERENCES.md). One mirrored instance per side. No circular bezel ring
 * around the hex pack itself — the hexagons tile directly against the
 * chassis fill, packed tight (not a rectangular dot grid like the NAS
 * vents, since the real grille is a honeycomb pattern). A thin border
 * traces just inside the face's own chamfered-octagon edge. 2 screws sit
 * centered within that bezel band (between the face's own outer edge and
 * the border line) on each of the face's four flat edges (long
 * front/back-facing ones and short top/bottom-facing ones — not the
 * angled chamfer-cut corners), 8 per face.
 */
export function FanGrille({ config, materials }: FanGrilleProps) {
  const { width, height, depth } = config.chassis.dimensions;
  const { chamfer } = config.chassis;
  const {
    radius,
    holeRadius,
    rings,
    borderInset,
    screwRadius,
    screwSpacingY,
    screwSpacingX,
  } = config.fanGrille;

  const borderGeometry = useMemo(
    () => createOctagonBorderGeometry(depth, height, chamfer, borderInset),
    [depth, height, chamfer, borderInset],
  );

  const screwGeometry = useMemo(
    () => new THREE.CircleGeometry(screwRadius, 12),
    [screwRadius],
  );

  // A regular hexagon is just a 6-segment circle.
  const hexGeometry = useMemo(
    () => new THREE.CircleGeometry(holeRadius, 6),
    [holeRadius],
  );

  const hexPositions = useMemo(() => {
    const size = holeRadius * 1.5;
    const positions: [number, number][] = [];
    for (let q = -rings; q <= rings; q++) {
      for (let r = -rings; r <= rings; r++) {
        if (Math.abs(q + r) > rings) continue;
        const a = size * 1.5 * q;
        const b = size * (Math.sqrt(3) / 2) * q + size * Math.sqrt(3) * r;
        if (Math.sqrt(a * a + b * b) > radius * 0.85) continue;
        positions.push([a, b]);
      }
    }
    return positions;
  }, [holeRadius, rings, radius]);

  const halfWidth = width / 2;
  // Pushed up toward the top third of the face — clamped so the circle
  // stays clear of the top edge (margin covers the hex pack's own extent
  // past the nominal grille radius).
  const grilleY = Math.max(0, height / 2 - radius - 4);
  // The two long edges run along height at a = +/-halfDepth (the flat
  // sections facing the chassis front/back faces); centered within the
  // bezel band, halfway between the face's own edge and the border line.
  const screwEdgeA = depth / 2 - borderInset / 2;
  // The two short (top/bottom) edges run along depth at b = +/-halfHeight;
  // same band-centered placement.
  const screwEdgeB = height / 2 - borderInset / 2;

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
            edgeMaterial={materials.edge}
            position={[0, 0, 0.01]}
          />
          <Instances
            geometry={hexGeometry}
            material={materials.voidActive}
            limit={hexPositions.length}
          >
            {hexPositions.map(([a, b], i) => (
              <Instance key={i} position={[a, b + grilleY, 0.02]} />
            ))}
          </Instances>
          {([-1, 1] as const).map((edgeSign) =>
            ([-1, 1] as const).map((ySign) => (
              <EdgedMesh
                key={`long-${edgeSign}-${ySign}`}
                geometry={screwGeometry}
                fillMaterial={materials.void}
                edgeMaterial={materials.edgeDim}
                position={[edgeSign * screwEdgeA, ySign * screwSpacingY, 0.02]}
              />
            )),
          )}
          {([-1, 1] as const).map((edgeSign) =>
            ([-1, 1] as const).map((xSign) => (
              <EdgedMesh
                key={`short-${edgeSign}-${xSign}`}
                geometry={screwGeometry}
                fillMaterial={materials.void}
                edgeMaterial={materials.edgeDim}
                position={[xSign * screwSpacingX, edgeSign * screwEdgeB, 0.02]}
              />
            )),
          )}
        </group>
      ))}
    </group>
  );
}
