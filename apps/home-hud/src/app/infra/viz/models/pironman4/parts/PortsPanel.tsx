import { useMemo } from 'react';
import * as THREE from 'three';
import { EdgedMesh } from '../../../components/EdgedMesh';
import type { Pironman4Config, PortSpec } from '../config';
import type { Pironman4Materials } from '../materials';

interface PortsPanelProps {
  config: Pironman4Config;
  materials: Pironman4Materials;
}

/**
 * The port cutouts on the rear (-Z) face. Moved here from the +X side
 * face per explicit correction — the only photo reference we have
 * (side-ports-labeled.jpg) actually shows a side panel, but the real
 * layout puts these ports on the rear; positions are still approximate
 * (no orthographic shot of the rear face exists), see REFERENCES.md.
 */
export function PortsPanel({ config, materials }: PortsPanelProps) {
  const { depth } = config.chassis.dimensions;
  const { ports } = config;

  const rearZ = -depth / 2;

  return (
    <group>
      {ports.map((port) => (
        <Port key={port.id} port={port} rearZ={rearZ} materials={materials} />
      ))}
    </group>
  );
}

function Port({
  port,
  rearZ,
  materials,
}: {
  port: PortSpec;
  rearZ: number;
  materials: Pironman4Materials;
}) {
  const geometry = useMemo(
    () =>
      port.shape === 'circle'
        ? new THREE.CircleGeometry(port.width / 2, 16)
        : new THREE.PlaneGeometry(port.width, port.height),
    [port.width, port.height, port.shape],
  );

  const [x, y] = port.position;

  return (
    <EdgedMesh
      geometry={geometry}
      fillMaterial={materials.void}
      edgeMaterial={materials.edgeDim}
      position={[x, y, rearZ]}
      rotation={[0, Math.PI, 0]}
    />
  );
}
