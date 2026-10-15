import * as THREE from 'three';

/** The shared octagon profile: a rectangle with its own four corners cut at 45°. */
function octagonShape(
  halfA: number,
  halfB: number,
  chamfer: number,
): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-halfA + chamfer, -halfB);
  shape.lineTo(halfA - chamfer, -halfB);
  shape.lineTo(halfA, -halfB + chamfer);
  shape.lineTo(halfA, halfB - chamfer);
  shape.lineTo(halfA - chamfer, halfB);
  shape.lineTo(-halfA + chamfer, halfB);
  shape.lineTo(-halfA, halfB - chamfer);
  shape.lineTo(-halfA, -halfB + chamfer);
  shape.closePath();
  return shape;
}

/**
 * A box whose LEFT and RIGHT faces (±X) are themselves chamfered octagons
 * — cut at their own top-left/top-right/bottom-left/bottom-right corners
 * (taper toward the top and bottom, in the depth×height plane). The
 * front/back/top/bottom walls stay flat. This is the Pironman4 case's
 * actual shape — the octagon profile shows on the SIDE, not the front/back
 * (two earlier versions put it on the front/back, or on the top/bottom;
 * both wrong — see REFERENCES.md for the full back-and-forth).
 *
 * Built as an extruded 2D shape so `EdgesGeometry` traces every real edge
 * (chamfers included) correctly. Origin is centered on all three axes,
 * matching this collection's chassis-center coordinate convention.
 */
export function createChamferedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  chamfer: number,
): THREE.ExtrudeGeometry {
  // The side-profile octagon (depth x height), as seen from directly left/right.
  const shape = octagonShape(depth / 2, height / 2, chamfer);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: false,
    steps: 1,
  });
  // The shape lies in the XY plane (X=depth, Y=height) and extrudes along Z
  // by default — rotate so the extrusion (and the chamfer corner facets)
  // run along world X (width) instead, then re-center.
  geometry.rotateY(Math.PI / 2);
  geometry.translate(-width / 2, 0, 0);

  return geometry;
}

/**
 * A small box whose FRONT and BACK faces (±Z) are chamfered octagons — for
 * parts like the Pironman4's inset bezel plate, which has its own cut
 * corners and physical thickness, independent of the chassis's own
 * side-chamfer shape (`createChamferedBoxGeometry` above). Shape lies in
 * the width×height plane and extrudes along depth — no rotation needed,
 * since that's `ExtrudeGeometry`'s default axis.
 */
export function createChamferedPanelGeometry(
  width: number,
  height: number,
  depth: number,
  chamfer: number,
): THREE.ExtrudeGeometry {
  const shape = octagonShape(width / 2, height / 2, chamfer);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);

  return geometry;
}

/**
 * A flat (unextruded) octagon matching `createChamferedBoxGeometry`'s own
 * face profile, inset by `inset` on every edge — traces a thin border just
 * inside a chamfered face. Pass the face's own (non-inset) width/height/
 * chamfer; the inset is subtracted here so the border chamfer stays a
 * consistent 45° cut rather than a parallel offset.
 */
export function createOctagonBorderGeometry(
  width: number,
  height: number,
  chamfer: number,
  inset: number,
): THREE.ShapeGeometry {
  const innerChamfer = Math.max(chamfer - inset, 0);
  const shape = octagonShape(
    width / 2 - inset,
    height / 2 - inset,
    innerChamfer,
  );
  return new THREE.ShapeGeometry(shape);
}
