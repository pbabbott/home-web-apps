import { useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { EdgedMesh } from '../../../components/EdgedMesh';
import type { NasConfig } from '../config';
import type { NasMaterials } from '../materials';
import type { BayState } from '../types';

interface DriveBayProps {
  config: NasConfig;
  materials: NasMaterials;
  bay: BayState;
  /** Computed once by AsustorNas via computeBayWidth() — not read from config.bays here. */
  bayWidth: number;
  positionX: number;
  positionY: number;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (bayId: string) => void;
  onHover: (bayId: string | null) => void;
}

/**
 * One tall vertical tray bezel in the 6-bay horizontal row, traced in line
 * art: a round captive keyhole lock at the bottom-center of the tray (not
 * a grip bar or side tab — per the front reference photo), two small
 * rectangular activity LED windows near the top, a thin edge trim strip
 * down each vertical edge, and a hinge seam line at the top.
 */
export function DriveBay({
  config,
  materials,
  bay,
  bayWidth,
  positionX,
  positionY,
  isSelected,
  isHovered,
  onSelect,
  onHover,
}: DriveBayProps) {
  const {
    bayHeight,
    bezelDepth,
    frontOffset,
    latchRadius,
    ledWindowWidth,
    ledWindowHeight,
    ledWindowGap,
    trimWidth,
  } = config.bays;
  const { depth } = config.dimensions;
  const { showTrayDetail } = config.detail;

  const bezelGeometry = useMemo(
    () => new THREE.BoxGeometry(bayWidth, bayHeight, bezelDepth),
    [bayWidth, bayHeight, bezelDepth],
  );
  const latchGeometry = useMemo(
    () => new THREE.CircleGeometry(latchRadius, 24),
    [latchRadius],
  );
  const ledWindowGeometry = useMemo(
    () => new THREE.PlaneGeometry(ledWindowWidth, ledWindowHeight),
    [ledWindowWidth, ledWindowHeight],
  );
  const trimGeometry = useMemo(
    () => new THREE.PlaneGeometry(trimWidth, bayHeight * 0.9),
    [trimWidth, bayHeight],
  );
  const hingeSeamGeometry = useMemo(
    () => new THREE.PlaneGeometry(bayWidth * 0.9, 0.001),
    [bayWidth],
  );

  const bezelZ = depth / 2 + config.fascia.depth + frontOffset + bezelDepth / 2;
  const faceZ = bezelDepth / 2 + 0.05;

  const fillMaterial = isSelected
    ? materials.voidSelected
    : isHovered
      ? materials.voidActive
      : materials.void;
  const edgeMaterial = isSelected
    ? materials.edgeSelected
    : isHovered
      ? materials.edge
      : materials.edgeDim;

  function handlePointerOver(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    onHover(bay.id);
  }

  function handlePointerOut(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    onHover(null);
  }

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect(bay.id);
  }

  return (
    <group position={[positionX, positionY, bezelZ]}>
      <EdgedMesh
        geometry={bezelGeometry}
        fillMaterial={fillMaterial}
        edgeMaterial={edgeMaterial}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      />
      {showTrayDetail && (
        <>
          <EdgedMesh
            geometry={trimGeometry}
            fillMaterial={materials.void}
            edgeMaterial={materials.edgeDim}
            position={[-bayWidth / 2 + trimWidth, 0, faceZ]}
          />
          <EdgedMesh
            geometry={trimGeometry}
            fillMaterial={materials.void}
            edgeMaterial={materials.edgeDim}
            position={[bayWidth / 2 - trimWidth, 0, faceZ]}
          />
          <EdgedMesh
            geometry={hingeSeamGeometry}
            fillMaterial={materials.void}
            edgeMaterial={materials.edgeDim}
            position={[0, bayHeight / 2 - 1, faceZ]}
          />
          <mesh
            geometry={ledWindowGeometry}
            material={materials.ledPrimary}
            position={[-ledWindowGap / 2, bayHeight / 2 - 8, faceZ]}
          />
          <mesh
            geometry={ledWindowGeometry}
            material={materials.ledAccent}
            position={[ledWindowGap / 2, bayHeight / 2 - 8, faceZ]}
          />
          <EdgedMesh
            geometry={latchGeometry}
            fillMaterial={materials.void}
            edgeMaterial={materials.edgeDim}
            position={[0, -bayHeight / 2 + latchRadius + 4, faceZ]}
          />
        </>
      )}
    </group>
  );
}
