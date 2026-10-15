import { useMemo } from 'react';
import * as THREE from 'three';
import { EdgedMesh } from '../../../components/EdgedMesh';
import type { BeelinkSer5Config, PortSpec } from '../config';
import type { BeelinkSer5Materials } from '../materials';

interface RearPanelProps {
  config: BeelinkSer5Config;
  materials: BeelinkSer5Materials;
}

/**
 * The port cutouts + vent slots on the rear (-Z) face, rebuilt from a real
 * dead-on rear photo (`photos/rear.jpg`) — see config.ts and REFERENCES.md
 * for the full correction log. DP+HDMI share a recessed-look surround
 * plaque, visible in the photo — rendered behind the ports (a smaller
 * proud-epsilon, so the ports sit visibly in front of it) rather than the
 * Pironman4's "no bounding plaque" approach, since this one is a real,
 * photo-confirmed feature rather than a guess at a recess. NOTE the
 * epsilon sign here is NEGATIVE (not the usual `+0.05`): on the rear
 * face, "toward the camera" is more negative Z, not more positive — see
 * docs/home-hud-3d-model-guide.md's rear-face gotcha. DP/HDMI use a
 * tapered 'trapezoid' shape and LAN uses a chamfered-corner 'rj45' shape
 * (see createTrapezoidGeometry/createRj45Geometry below) instead of plain
 * rects — stylized past strict photo fidelity, per explicit request, see
 * REFERENCES.md.
 */
export function RearPanel({ config, materials }: RearPanelProps) {
  const { depth } = config.chassis.dimensions;
  const { rearPorts, rearShields, rearVentSlots } = config;

  const rearZ = -depth / 2;
  const shieldZ = rearZ - 0.02;
  const detailZ = rearZ - 0.05;

  return (
    <group>
      {rearShields.map((shield, i) => (
        <Shield key={i} shield={shield} z={shieldZ} materials={materials} />
      ))}
      {rearPorts.map((port) => (
        <Port key={port.id} port={port} z={detailZ} materials={materials} />
      ))}
      {rearVentSlots.map((slot, i) => (
        <GrateSlot key={i} slot={slot} z={detailZ} materials={materials} />
      ))}
    </group>
  );
}

/** Wider on the bottom edge, narrower on top (by `taper` of the full width) — DP/HDMI connectors taper rather than being plain rectangles. */
function createTrapezoidGeometry(
  width: number,
  height: number,
  taper = 0.35,
): THREE.ShapeGeometry {
  const halfW = width / 2;
  const halfH = height / 2;
  const topHalfW = halfW * (1 - taper);
  const shape = new THREE.Shape();
  shape.moveTo(-halfW, -halfH);
  shape.lineTo(halfW, -halfH);
  shape.lineTo(topHalfW, halfH);
  shape.lineTo(-topHalfW, halfH);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/** A chamfered-bottom-corner body with a small top-center release-clip notch — the real RJ45 jack silhouette, not a plain square. */
function createRj45Geometry(
  width: number,
  height: number,
): THREE.ShapeGeometry {
  const halfW = width / 2;
  const halfH = height / 2;
  const chamfer = Math.min(width, height) * 0.12;
  const tabHalfW = width * 0.11;
  const bodyTopY = halfH - height * 0.18;
  const shape = new THREE.Shape();
  shape.moveTo(-halfW + chamfer, -halfH);
  shape.lineTo(halfW - chamfer, -halfH);
  shape.lineTo(halfW, -halfH + chamfer);
  shape.lineTo(halfW, bodyTopY);
  shape.lineTo(tabHalfW, bodyTopY);
  shape.lineTo(tabHalfW, halfH);
  shape.lineTo(-tabHalfW, halfH);
  shape.lineTo(-tabHalfW, bodyTopY);
  shape.lineTo(-halfW, bodyTopY);
  shape.lineTo(-halfW, -halfH + chamfer);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function Port({
  port,
  z,
  materials,
}: {
  port: PortSpec;
  z: number;
  materials: BeelinkSer5Materials;
}) {
  const geometry = useMemo(() => {
    if (port.shape === 'circle')
      return new THREE.CircleGeometry(port.width / 2, 16);
    if (port.shape === 'trapezoid')
      return createTrapezoidGeometry(port.width, port.height);
    if (port.shape === 'rj45')
      return createRj45Geometry(port.width, port.height);
    return new THREE.PlaneGeometry(port.width, port.height);
  }, [port.width, port.height, port.shape]);

  const [x, y] = port.position;

  return (
    <EdgedMesh
      geometry={geometry}
      fillMaterial={materials.void}
      edgeMaterial={materials.edgeDim}
      position={[x, y, z]}
      rotation={[0, Math.PI, 0]}
    />
  );
}

/** The plain rect backing plaque behind DP+HDMI — no slats, unlike GrateSlot. */
function Shield({
  shield,
  z,
  materials,
}: {
  shield: { position: [number, number]; width: number; height: number };
  z: number;
  materials: BeelinkSer5Materials;
}) {
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(shield.width, shield.height),
    [shield.width, shield.height],
  );

  const [x, y] = shield.position;

  return (
    <EdgedMesh
      geometry={geometry}
      fillMaterial={materials.void}
      edgeMaterial={materials.edgeDim}
      position={[x, y, z]}
      rotation={[0, Math.PI, 0]}
    />
  );
}

/**
 * A wide horizontal vent slot with vertical slat lines across it, so it
 * reads as a grate rather than a bare rectangle — matches the mesh texture
 * visible inside each slot in `photos/rear.jpg`. Slats are plain
 * `lineSegments` (not individually wrapped `EdgedMesh` fills) since
 * they're flat line detail, not real volumes — same "line art, not solid
 * shapes" principle as every other dense-repeated-detail pass in this
 * collection.
 */
function GrateSlot({
  slot,
  z,
  materials,
}: {
  slot: { position: [number, number]; width: number; height: number };
  z: number;
  materials: BeelinkSer5Materials;
}) {
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(slot.width, slot.height),
    [slot.width, slot.height],
  );

  const slatCount = Math.max(3, Math.round(slot.width / 3.5));
  const slatGeometry = useMemo(() => {
    const marginX = slot.width * 0.1;
    const usableWidth = slot.width - marginX * 2;
    const halfSlatHeight = slot.height / 2 - slot.height * 0.15;
    const positions: number[] = [];
    for (let i = 0; i < slatCount; i++) {
      const x =
        slatCount === 1
          ? 0
          : -usableWidth / 2 + (usableWidth / (slatCount - 1)) * i;
      positions.push(x, -halfSlatHeight, 0, x, halfSlatHeight, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    return geo;
  }, [slot.width, slot.height, slatCount]);

  const [x, y] = slot.position;

  return (
    <group>
      <EdgedMesh
        geometry={geometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edgeDim}
        position={[x, y, z]}
        rotation={[0, Math.PI, 0]}
      />
      <group position={[x, y, z]} rotation={[0, Math.PI, 0]}>
        <lineSegments geometry={slatGeometry} material={materials.edgeDim} />
      </group>
    </group>
  );
}
