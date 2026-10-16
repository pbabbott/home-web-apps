import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useBrandTexture } from '../../../components/brand-texture';
import { EdgedMesh } from '../../../components/EdgedMesh';
import {
  computeButtonPitch,
  computeButtonSize,
  computeButtonsCenterX,
  computeButtonsCenterY,
  computeDisplayLeftEdge,
  computeDisplayWidth,
  type NasConfig,
} from '../config';
import type { NasMaterials } from '../materials';

interface HeaderPanelProps {
  config: NasConfig;
  materials: NasMaterials;
}

/**
 * The strip above the bay row, traced in line art: a left-edge plate
 * (brand wordmark, power/activity LED bars, USB port), a recessed display
 * window with its own bezel outline, and a 2x2 square nav button cluster —
 * matches the real front reference photo
 * (public/nas-asustor/photos/front.jpg).
 */
export function HeaderPanel({ config, materials }: HeaderPanelProps) {
  const { width, height, depth } = config.dimensions;
  const {
    leftStripWidth,
    height: headerHeight,
    brandText,
    brandWidth,
    brandHeight,
    ledBarWidth,
    ledBarHeight,
    ledBarGap,
    usbWidth,
    usbHeight,
    usbOffsetFromBottom,
    displayHeight,
    displayBezelMargin,
  } = config.header;

  const brandTexture = useBrandTexture(brandText);
  const displayWidth = computeDisplayWidth(config);
  const buttonSize = computeButtonSize(config);

  const headerY = height / 2 - headerHeight / 2;
  const frontZ = depth / 2 + config.fascia.depth;

  const leftStripGeometry = useMemo(
    () => new THREE.PlaneGeometry(leftStripWidth, height - 2),
    [leftStripWidth, height],
  );
  const brandGeometry = useMemo(
    () => new THREE.PlaneGeometry(brandWidth, brandHeight),
    [brandWidth, brandHeight],
  );
  const brandMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: brandTexture, transparent: true }),
    [brandTexture],
  );
  useEffect(() => () => brandMaterial.dispose(), [brandMaterial]);

  const ledBarGeometry = useMemo(
    () => new THREE.PlaneGeometry(ledBarWidth, ledBarHeight),
    [ledBarWidth, ledBarHeight],
  );
  const usbGeometry = useMemo(
    () => new THREE.PlaneGeometry(usbWidth, usbHeight),
    [usbWidth, usbHeight],
  );
  const displayBezelGeometry = useMemo(
    () =>
      new THREE.PlaneGeometry(
        displayWidth + displayBezelMargin * 2,
        displayHeight + displayBezelMargin * 2,
      ),
    [displayWidth, displayHeight, displayBezelMargin],
  );
  const displayGeometry = useMemo(
    () => new THREE.PlaneGeometry(displayWidth, displayHeight),
    [displayWidth, displayHeight],
  );
  const buttonGeometry = useMemo(
    () => new THREE.PlaneGeometry(buttonSize, buttonSize),
    [buttonSize],
  );

  const leftStripX = -width / 2 + leftStripWidth / 2;
  const usbY = -height / 2 + usbOffsetFromBottom;

  const displayX = computeDisplayLeftEdge(config) + displayWidth / 2;
  // Anchored to the chassis' top-right corner, independent of display
  // width/header-center — the photo shows a tight 2x2 block tucked into
  // the corner, not centered in the header.
  const buttonsCenterX = computeButtonsCenterX(config);
  const buttonsCenterY = computeButtonsCenterY(config);
  const buttonPitch = computeButtonPitch(config);

  // Tight 2x2 grid (edges nearly touching, just buttonGap apart) — up/back
  // on top, down/enter on bottom, matching the real button cluster.
  const buttonOffsets: [number, number][] = [
    [-buttonPitch / 2, buttonPitch / 2],
    [buttonPitch / 2, buttonPitch / 2],
    [-buttonPitch / 2, -buttonPitch / 2],
    [buttonPitch / 2, -buttonPitch / 2],
  ];

  return (
    <group>
      <EdgedMesh
        geometry={leftStripGeometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edgeDim}
        position={[leftStripX, 0, frontZ + 0.05]}
      />
      <mesh
        geometry={brandGeometry}
        material={brandMaterial}
        position={[leftStripX, height / 2 - 14, frontZ + 0.1]}
      />
      <mesh
        geometry={ledBarGeometry}
        material={materials.ledPrimary}
        position={[leftStripX, headerY + ledBarGap, frontZ + 0.1]}
      />
      <mesh
        geometry={ledBarGeometry}
        material={materials.ledAccent}
        position={[leftStripX, headerY - ledBarGap, frontZ + 0.1]}
      />
      <EdgedMesh
        geometry={usbGeometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edgeDim}
        position={[leftStripX, usbY, frontZ + 0.05]}
      />

      <EdgedMesh
        geometry={displayBezelGeometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edgeDim}
        position={[displayX, headerY, frontZ + 0.02]}
      />
      <EdgedMesh
        geometry={displayGeometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edge}
        position={[displayX, headerY, frontZ + 0.08]}
      />

      {buttonOffsets.map(([dx, dy], i) => (
        <EdgedMesh
          key={i}
          geometry={buttonGeometry}
          fillMaterial={materials.void}
          edgeMaterial={materials.edgeDim}
          position={[buttonsCenterX + dx, buttonsCenterY + dy, frontZ + 0.1]}
        />
      ))}
    </group>
  );
}
