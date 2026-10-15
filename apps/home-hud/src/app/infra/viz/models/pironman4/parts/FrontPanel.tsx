import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useBrandTexture } from '../../../components/brand-texture';
import { createChamferedPanelGeometry } from '../../../components/chamfered-box';
import { EdgedMesh } from '../../../components/EdgedMesh';
import type { Pironman4Config } from '../config';
import type { Pironman4Materials } from '../materials';

interface FrontPanelProps {
  config: Pironman4Config;
  materials: Pironman4Materials;
}

/**
 * The front face: an inset bezel plate holding the OLED display and the
 * illuminated power button, plus the "PIRONMAN" brand wordmark above it —
 * matches the front reference photos (threeQuarter-1.jpg/threeQuarter-2.jpg).
 * The plate itself is a small chamfered-octagon box (its own cut corners,
 * not the chassis's), proud of the chassis front face by `plateDepth`. The
 * IR receiver (visible in threeQuarter-labeled.jpg) is modeled as a small
 * unlit lens dot, mirrored off the power button for visual balance — no
 * exact position is known from the only (3/4-angle) reference photo.
 */
export function FrontPanel({ config, materials }: FrontPanelProps) {
  const { depth, height } = config.chassis.dimensions;
  const { chamfer } = config.chassis;
  const {
    plateWidth,
    plateHeight,
    plateDepth,
    plateChamfer,
    plateOffsetY,
    screwRadius,
    screwInset,
    displayWidth,
    displayHeight,
    displayOffsetY,
    buttonRadius,
    buttonOffsetX,
    buttonOffsetY,
    irRadius,
    irOffsetX,
    irOffsetY,
    brandText,
    brandWidth,
    brandHeight,
    brandOffsetY,
  } = config.frontPanel;

  const brandTexture = useBrandTexture(brandText);
  const brandMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: brandTexture, transparent: true }),
    [brandTexture],
  );
  useEffect(() => () => brandMaterial.dispose(), [brandMaterial]);

  const plateGeometry = useMemo(
    () =>
      createChamferedPanelGeometry(
        plateWidth,
        plateHeight,
        plateDepth,
        plateChamfer,
      ),
    [plateWidth, plateHeight, plateDepth, plateChamfer],
  );
  const displayGeometry = useMemo(
    () => new THREE.PlaneGeometry(displayWidth, displayHeight),
    [displayWidth, displayHeight],
  );
  const buttonRingGeometry = useMemo(
    () => new THREE.CircleGeometry(buttonRadius, 20),
    [buttonRadius],
  );
  const buttonGlowGeometry = useMemo(
    () => new THREE.CircleGeometry(buttonRadius * 0.55, 16),
    [buttonRadius],
  );
  const irGeometry = useMemo(
    () => new THREE.CircleGeometry(irRadius, 16),
    [irRadius],
  );
  const screwGeometry = useMemo(
    () => new THREE.CircleGeometry(screwRadius, 12),
    [screwRadius],
  );
  const brandGeometry = useMemo(
    () => new THREE.PlaneGeometry(brandWidth, brandHeight),
    [brandWidth, brandHeight],
  );

  const frontZ = depth / 2;
  // The plate's back face sits flush against the chassis front; it then
  // sticks out by its own depth, so its outer face is further forward.
  const plateCenterZ = frontZ + plateDepth / 2;
  const plateFrontZ = frontZ + plateDepth;
  const screwX = plateWidth / 2 - screwInset;
  const screwY = plateHeight / 2 - screwInset;

  // Top-front chamfer facet: midpoint of the cut corner (equal legs, so a
  // flat 45° strip), nudged out along its own normal to sit proud of it.
  const bevelY = height / 2 - chamfer / 2;
  const bevelZ = depth / 2 - chamfer / 2;
  const bevelNormalY = Math.SQRT1_2;
  const bevelNormalZ = Math.SQRT1_2;
  const brandEps = 0.05;

  return (
    <group>
      <EdgedMesh
        geometry={plateGeometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edgeDim}
        position={[0, plateOffsetY, plateCenterZ]}
      />
      <EdgedMesh
        geometry={displayGeometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edge}
        position={[0, displayOffsetY, plateFrontZ + 0.05]}
      />
      <EdgedMesh
        geometry={buttonRingGeometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edge}
        position={[buttonOffsetX, buttonOffsetY, plateFrontZ + 0.05]}
      />
      <mesh
        geometry={buttonGlowGeometry}
        material={materials.accent}
        position={[buttonOffsetX, buttonOffsetY, plateFrontZ + 0.06]}
      />
      <EdgedMesh
        geometry={irGeometry}
        fillMaterial={materials.void}
        edgeMaterial={materials.edgeDim}
        position={[irOffsetX, irOffsetY, plateFrontZ + 0.05]}
      />
      <mesh
        geometry={brandGeometry}
        material={brandMaterial}
        position={[
          0,
          bevelY + bevelNormalY * brandEps + brandOffsetY,
          bevelZ + bevelNormalZ * brandEps,
        ]}
        rotation={[-Math.PI / 4, 0, 0]}
      />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sy) => (
          <EdgedMesh
            key={`${sx}-${sy}`}
            geometry={screwGeometry}
            fillMaterial={materials.void}
            edgeMaterial={materials.edgeDim}
            position={[
              sx * screwX,
              plateOffsetY + sy * screwY,
              plateFrontZ + 0.05,
            ]}
          />
        )),
      )}
    </group>
  );
}
