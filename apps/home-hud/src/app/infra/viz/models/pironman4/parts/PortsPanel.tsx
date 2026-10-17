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
 * The port cutouts on the rear (-Z) face, laid out from a real close-up
 * reference (`back-ports.jpg`) — see REFERENCES.md for the 90deg
 * photo-to-face orientation mapping. No bounding plaque around the
 * LAN/USB/microSD/SSD/Power cluster — the chassis shell is a closed,
 * opaque box, so a plane standing in for the photo's recessed I/O shield
 * can only ever sit PROUD of the rear face, not sunk into it, which read
 * as a floating box rather than a recess. Dropped; just the ports
 * themselves, each proud of the rear face by a fixed epsilon.
 */
export function PortsPanel({ config, materials }: PortsPanelProps) {
  const { depth } = config.chassis.dimensions;
  const { ports } = config;

  const rearZ = -depth / 2;
  const portZ = rearZ - 0.05;

  return (
    <group>
      {ports.map((port) => (
        <Port key={port.id} port={port} portZ={portZ} materials={materials} />
      ))}
    </group>
  );
}

function Port({
  port,
  portZ,
  materials,
}: {
  port: PortSpec;
  portZ: number;
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
      position={[x, y, portZ]}
      rotation={[0, Math.PI, 0]}
    />
  );
}
