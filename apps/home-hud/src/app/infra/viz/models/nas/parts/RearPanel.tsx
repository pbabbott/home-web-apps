import { useMemo } from 'react';
import * as THREE from 'three';
import { EdgedMesh } from '../../../components/EdgedMesh';
import type { NasConfig, RearPortSpec, ScrewSpec } from '../config';
import type { NasMaterials } from '../materials';

interface RearPanelProps {
  config: NasConfig;
  materials: NasMaterials;
}

function createTrapezoidGeometry(
  width: number,
  height: number,
): THREE.ShapeGeometry {
  // HDMI type-A ports are trapezoidal (narrower at the top), not a plain
  // rectangle — per the rear reference photo.
  const topWidth = width * 0.7;
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(width / 2, -height / 2);
  shape.lineTo(topWidth / 2, height / 2);
  shape.lineTo(-topWidth / 2, height / 2);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/** RJ45 silhouette: a rect with a small clip-tab protruding from the bottom edge. */
function createEthernetGeometry(
  width: number,
  height: number,
): THREE.ShapeGeometry {
  const tabWidth = width * 0.4;
  const tabHeight = height * 0.35;
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(-tabWidth / 2, -height / 2);
  shape.lineTo(-tabWidth / 2, -height / 2 - tabHeight);
  shape.lineTo(tabWidth / 2, -height / 2 - tabHeight);
  shape.lineTo(tabWidth / 2, -height / 2);
  shape.lineTo(width / 2, -height / 2);
  shape.lineTo(width / 2, height / 2);
  shape.lineTo(-width / 2, height / 2);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/**
 * Rear panel, traced in line art — matches the real rear reference photo
 * (public/nas-asustor/photos/rear.jpg): a main case fan (square
 * corner-screwed bezel + circular guard ring + a concentric-ring-arc
 * "maze" grille, each ring's gap rotated against its neighbors), a
 * smaller PSU fan next to the power inlet, a small top-center cover
 * plate, the port column (with a trapezoidal HDMI, not rectangular), and
 * scattered chassis screws.
 */
export function RearPanel({ config, materials }: RearPanelProps) {
  const { depth } = config.dimensions;
  const {
    fanRadius,
    fanPosition,
    fanBezelSize,
    fanGuardRingCount,
    fanGuardGapDegrees,
    fanGuardRingWidth,
    fanGuardRotationStepDegrees,
    psuFanRadius,
    psuFanPosition,
    psuFanBezelSize,
    topPlateWidth,
    topPlateHeight,
    topPlatePosition,
    ports,
    screws,
  } = config.rear;

  const fanRingGeometry = useMemo(
    () => new THREE.CircleGeometry(fanRadius, 32),
    [fanRadius],
  );
  const fanBezelGeometry = useMemo(
    () => new THREE.PlaneGeometry(fanBezelSize, fanBezelSize),
    [fanBezelSize],
  );
  // Concentric ring arcs (each with a gap, rotated against its neighbors)
  // — a maze-like fan guard grille, not radial blades.
  const guardRingGeometries = useMemo(() => {
    const gapRad = (fanGuardGapDegrees * Math.PI) / 180;
    const stepRad = (fanGuardRotationStepDegrees * Math.PI) / 180;
    return Array.from({ length: fanGuardRingCount }, (_, i) => {
      const outerR = (fanRadius * 0.95 * (i + 1)) / fanGuardRingCount;
      const innerR = outerR - fanGuardRingWidth;
      const thetaStart = i * stepRad;
      return new THREE.RingGeometry(
        innerR,
        outerR,
        32,
        1,
        thetaStart,
        Math.PI * 2 - gapRad,
      );
    });
  }, [
    fanRadius,
    fanGuardRingCount,
    fanGuardGapDegrees,
    fanGuardRingWidth,
    fanGuardRotationStepDegrees,
  ]);
  const psuFanGeometry = useMemo(
    () => new THREE.CircleGeometry(psuFanRadius, 24),
    [psuFanRadius],
  );
  const psuFanBezelGeometry = useMemo(
    () => new THREE.PlaneGeometry(psuFanBezelSize, psuFanBezelSize),
    [psuFanBezelSize],
  );
  const topPlateGeometry = useMemo(
    () => new THREE.PlaneGeometry(topPlateWidth, topPlateHeight),
    [topPlateWidth, topPlateHeight],
  );

  const rearZ = -depth / 2 - 0.05;
  const [fanX, fanY] = fanPosition;
  const [psuFanX, psuFanY] = psuFanPosition;
  const [topPlateX, topPlateY] = topPlatePosition;

  return (
    <group>
      <EdgedMesh
        geometry={fanBezelGeometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edgeDim}
        position={[fanX, fanY, rearZ + 0.02]}
      />
      <EdgedMesh
        geometry={fanRingGeometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edge}
        position={[fanX, fanY, rearZ]}
        rotation={[0, Math.PI, 0]}
      />
      {guardRingGeometries.map((geometry, i) => (
        <EdgedMesh
          key={i}
          geometry={geometry}
          fillMaterial={materials.void}
          edgeMaterial={materials.edgeDim}
          position={[fanX, fanY, rearZ]}
          rotation={[0, Math.PI, 0]}
        />
      ))}

      <EdgedMesh
        geometry={psuFanBezelGeometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edgeDim}
        position={[psuFanX, psuFanY, rearZ + 0.02]}
      />
      <EdgedMesh
        geometry={psuFanGeometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edge}
        position={[psuFanX, psuFanY, rearZ]}
        rotation={[0, Math.PI, 0]}
      />

      <EdgedMesh
        geometry={topPlateGeometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edgeDim}
        position={[topPlateX, topPlateY, rearZ]}
        rotation={[0, Math.PI, 0]}
      />

      {ports.map((port) => (
        <Port key={port.id} port={port} rearZ={rearZ} materials={materials} />
      ))}

      {screws.map((screw, i) => (
        <Screw key={i} screw={screw} rearZ={rearZ} materials={materials} />
      ))}
    </group>
  );
}

/**
 * Each connector kind gets its own silhouette/internal detail so the
 * column reads as "ethernet, USB, HDMI, power" at a glance instead of six
 * identical rectangles — per explicit request.
 */
function Port({
  port,
  rearZ,
  materials,
}: {
  port: RearPortSpec;
  rearZ: number;
  materials: NasMaterials;
}) {
  const { width, height, kind, position } = port;
  const [x, y] = position;

  const outlineGeometry = useMemo(() => {
    if (port.shape === 'trapezoid')
      return createTrapezoidGeometry(width, height);
    if (kind === 'ethernet') return createEthernetGeometry(width, height);
    return new THREE.PlaneGeometry(width, height);
  }, [width, height, port.shape, kind]);

  // USB: a smaller inset rect showing the connector's internal tongue/slot.
  const usbTongueGeometry = useMemo(
    () => new THREE.PlaneGeometry(width * 0.6, height * 0.45),
    [width, height],
  );

  // Power (IEC C14): two flat blade-pin slits up top, one round ground pin below.
  const powerBladeGeometry = useMemo(
    () => new THREE.PlaneGeometry(width * 0.14, height * 0.22),
    [width, height],
  );
  const powerGroundGeometry = useMemo(
    () => new THREE.CircleGeometry(height * 0.12, 12),
    [height],
  );

  // Kensington: the slot plus its small lock-loop hole alongside it.
  const kensingtonHoleGeometry = useMemo(
    () => new THREE.CircleGeometry(height * 0.4, 10),
    [height],
  );

  return (
    <group position={[x, y, rearZ]}>
      <EdgedMesh
        geometry={outlineGeometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edgeDim}
        rotation={[0, Math.PI, 0]}
      />
      {kind === 'usb' && (
        <EdgedMesh
          geometry={usbTongueGeometry}
          fillMaterial={materials.void}
          edgeMaterial={materials.edgeDim}
          position={[0, -height * 0.08, -0.02]}
          rotation={[0, Math.PI, 0]}
        />
      )}
      {kind === 'power' && (
        <>
          <EdgedMesh
            geometry={powerBladeGeometry}
            fillMaterial={materials.void}
            edgeMaterial={materials.edgeDim}
            position={[-width * 0.2, height * 0.15, -0.02]}
            rotation={[0, Math.PI, 0]}
          />
          <EdgedMesh
            geometry={powerBladeGeometry}
            fillMaterial={materials.void}
            edgeMaterial={materials.edgeDim}
            position={[width * 0.2, height * 0.15, -0.02]}
            rotation={[0, Math.PI, 0]}
          />
          <EdgedMesh
            geometry={powerGroundGeometry}
            fillMaterial={materials.void}
            edgeMaterial={materials.edgeDim}
            position={[0, -height * 0.2, -0.02]}
            rotation={[0, Math.PI, 0]}
          />
        </>
      )}
      {kind === 'kensington' && (
        <EdgedMesh
          geometry={kensingtonHoleGeometry}
          fillMaterial={materials.void}
          edgeMaterial={materials.edgeDim}
          position={[width * 0.9, 0, -0.02]}
          rotation={[0, Math.PI, 0]}
        />
      )}
    </group>
  );
}

function Screw({
  screw,
  rearZ,
  materials,
}: {
  screw: ScrewSpec;
  rearZ: number;
  materials: NasMaterials;
}) {
  const geometry = useMemo(
    () => new THREE.CircleGeometry(screw.radius, 12),
    [screw.radius],
  );

  return (
    <EdgedMesh
      geometry={geometry}
      fillMaterial={materials.void}
      edgeMaterial={materials.edgeDim}
      position={[screw.position[0], screw.position[1], rearZ + 0.01]}
      rotation={[0, Math.PI, 0]}
    />
  );
}
