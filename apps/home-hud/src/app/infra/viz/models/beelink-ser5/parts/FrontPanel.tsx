import { useMemo } from 'react';
import * as THREE from 'three';
import { createChamferedPanelGeometry } from '../../../components/chamfered-box';
import { EdgedMesh } from '../../../components/EdgedMesh';
import type { BeelinkSer5Config, PortSpec } from '../config';
import type { BeelinkSer5Materials } from '../materials';

interface FrontPanelProps {
  config: BeelinkSer5Config;
  materials: BeelinkSer5Materials;
}

/**
 * The front (+Z) face: a rectangular bezel plate with lightly rounded
 * corners (its own small chamfered-corner box, proud of the chassis front
 * face — same technique as the Pironman4's front plate, see
 * createChamferedPanelGeometry) holding the full I/O row, centered on the
 * face's own horizontal midline — matches `photos/front.jpg` (dead-on, the
 * only orthographic reference this model has). No vent/dot patch and no
 * brand trim/wordmark on this face (both removed per explicit correction —
 * see REFERENCES.md).
 */
export function FrontPanel({ config, materials }: FrontPanelProps) {
  const { depth } = config.chassis.dimensions;
  const { bezel, bezelOffsetY, ports, buttonRadius } = config.frontPanel;

  const frontZ = depth / 2;
  const bezelCenterZ = frontZ + bezel.depth / 2;
  const bezelFrontZ = frontZ + bezel.depth;
  const detailZ = bezelFrontZ + 0.05;

  const bezelGeometry = useMemo(
    () =>
      createChamferedPanelGeometry(
        bezel.width,
        bezel.height,
        bezel.depth,
        bezel.chamfer,
      ),
    [bezel.width, bezel.height, bezel.depth, bezel.chamfer],
  );

  return (
    <group>
      <EdgedMesh
        geometry={bezelGeometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edgeDim}
        position={[0, bezelOffsetY, bezelCenterZ]}
      />
      {ports.map((port) => (
        <Port
          key={port.id}
          port={port}
          z={detailZ}
          materials={materials}
          bezelOffsetY={bezelOffsetY}
          buttonRadius={buttonRadius}
        />
      ))}
    </group>
  );
}

function Port({
  port,
  z,
  materials,
  bezelOffsetY,
  buttonRadius,
}: {
  port: PortSpec;
  z: number;
  materials: BeelinkSer5Materials;
  bezelOffsetY: number;
  buttonRadius: number;
}) {
  const geometry = useMemo(
    () =>
      port.shape === 'circle'
        ? new THREE.CircleGeometry(port.width / 2, 16)
        : new THREE.PlaneGeometry(port.width, port.height),
    [port.width, port.height, port.shape],
  );

  const [x, y] = port.position;
  const isPower = port.id === 'power';

  const glowGeometry = useMemo(
    () => new THREE.CircleGeometry(buttonRadius * 0.55, 16),
    [buttonRadius],
  );

  // The universal power-symbol icon — a broken ring (gap at top) plus a
  // short vertical bar through the gap — drawn in `materials.powerIcon`
  // (neutral-300, near-white) over the red glow, matching the real
  // button's white icon. See REFERENCES.md.
  const iconOuterRadius = buttonRadius * 0.55;
  const iconInnerRadius = iconOuterRadius * 0.7;
  const iconGapHalfAngle = 0.61; // ~35deg
  const ringGeometry = useMemo(
    () =>
      new THREE.RingGeometry(
        iconInnerRadius,
        iconOuterRadius,
        24,
        1,
        Math.PI / 2 + iconGapHalfAngle,
        Math.PI * 2 - iconGapHalfAngle * 2,
      ),
    [iconInnerRadius, iconOuterRadius],
  );
  const barWidth = iconOuterRadius * 0.22;
  const barTop = iconOuterRadius * 1.0;
  const barBottom = -iconOuterRadius * 0.05;
  const barGeometry = useMemo(
    () => new THREE.PlaneGeometry(barWidth, barTop - barBottom),
    [barWidth, barTop, barBottom],
  );

  return (
    <group>
      <EdgedMesh
        geometry={geometry}
        fillMaterial={materials.void}
        edgeMaterial={isPower ? materials.edge : materials.edgeDim}
        position={[x, bezelOffsetY + y, z]}
      />
      {isPower && (
        <group>
          <mesh
            geometry={glowGeometry}
            material={materials.accent}
            position={[x, bezelOffsetY + y, z + 0.01]}
          />
          <mesh
            geometry={ringGeometry}
            material={materials.powerIcon}
            position={[x, bezelOffsetY + y, z + 0.02]}
          />
          <mesh
            geometry={barGeometry}
            material={materials.powerIcon}
            position={[
              x,
              bezelOffsetY + y + (barTop + barBottom) / 2,
              z + 0.02,
            ]}
          />
        </group>
      )}
    </group>
  );
}
