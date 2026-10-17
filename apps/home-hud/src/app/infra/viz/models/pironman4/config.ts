/**
 * Centralized dimensions/materials/colors for the procedural Pironman4
 * (SunFounder Pironman 4 Raspberry Pi case) model. Change a number here,
 * not in a part file.
 *
 * Coordinate system (matches the NAS model's convention — see
 * models/nas/config.ts): origin is the chassis' geometric center,
 * +X = right, +Y = up, +Z = toward the camera / front of the unit. Units
 * are millimeters.
 *
 * Shape confirmed only from 3/4-angle marketing photos (see
 * REFERENCES.md) — no orthographic front/rear/top shots exist yet, so
 * several faces are best-effort. The rear face now has a real close-up
 * reference (`back-ports.jpg`) and is laid out from it — see REFERENCES.md.
 *
 * Rendering style is the same Tron-style line art as every model in this
 * collection — see docs/home-hud-3d-model-guide.md before changing
 * materials.ts.
 */

export interface NasDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface ChassisConfig {
  dimensions: NasDimensions;
  /** Corner cut size for the chamfered (octagonal cross-section) shell — see components/chamfered-box.ts. */
  chamfer: number;
}

export interface FrontPanelConfig {
  /** Inset bezel plate holding the OLED + power button — its own chamfered-octagon box, proud of the chassis front face. */
  plateWidth: number;
  plateHeight: number;
  plateDepth: number;
  plateChamfer: number;
  plateOffsetY: number;
  /** Four corner screws, inset from the plate's own edges (clear of its chamfer cut). */
  screwRadius: number;
  screwInset: number;
  displayWidth: number;
  displayHeight: number;
  displayOffsetY: number;
  buttonRadius: number;
  buttonOffsetX: number;
  buttonOffsetY: number;
  /** Small unlit lens dot — no exact reference position (3/4-angle photo only), mirrored off the button for visual balance. */
  irRadius: number;
  irOffsetX: number;
  irOffsetY: number;
  brandText: string;
  brandWidth: number;
  brandHeight: number;
  /** Lives on the chassis's top-front chamfer facet, not the flat front face — this is a fine nudge up/down along that bevel's own slope, not a world-Y offset. */
  brandOffsetY: number;
}

/** Hex-grille tower-cooler fan intake, mirrored on the left and right (±X) faces (see REFERENCES.md). */
export interface FanGrilleConfig {
  radius: number;
  holeRadius: number;
  rings: number;
  /** Thin border traced just inside the side face's own chamfered-octagon edge. */
  borderInset: number;
  /** 2 screws on each of the face's two long (flat, non-chamfered) edges — the ones facing front/back, not the angled corner cuts. Centered within the bezel band (between the face's outer edge and the border line). */
  screwRadius: number;
  /** +/- offset along height for the 2 side screws on each long (front/back) edge. */
  screwSpacingY: number;
  /** +/- offset along depth for the 2 screws on each short (top/bottom) edge. */
  screwSpacingX: number;
}

export interface PortSpec {
  id: string;
  label: string;
  /**
   * [x, y] offset within the rear (-Z) ports face. The face's own Z is
   * computed by the part from chassis.dimensions.depth, not stored here.
   */
  position: [number, number];
  width: number;
  height: number;
  /** USB-C ports (ssd/power) are rendered as a plain small rect — no distinct capsule shape. */
  shape?: 'rect' | 'circle';
}

export interface MaterialColors {
  void: string;
  edgeHighlight: string;
  ledActivity: string;
}

export interface Pironman4Config {
  chassis: ChassisConfig;
  frontPanel: FrontPanelConfig;
  fanGrille: FanGrilleConfig;
  ports: PortSpec[];
  materials: MaterialColors;
}

export const PIRONMAN4_CONFIG: Pironman4Config = {
  chassis: {
    // A small tower, taller than it is wide/deep — matches the hand-held
    // scale shown in the product photos. Not measured.
    dimensions: {
      width: 65,
      height: 125,
      depth: 105,
    },
    chamfer: 18,
  },
  frontPanel: {
    plateWidth: 50,
    plateHeight: 56,
    plateDepth: 2,
    plateChamfer: 4,
    plateOffsetY: -4,
    screwRadius: 1.5,
    screwInset: 5,
    displayWidth: 34,
    displayHeight: 20,
    displayOffsetY: 2,
    buttonRadius: 5.5,
    buttonOffsetX: 12,
    buttonOffsetY: -20,
    irRadius: 2.5,
    irOffsetX: -12,
    irOffsetY: -20,
    brandText: 'PIRONMAN',
    brandWidth: 50,
    brandHeight: 9,
    brandOffsetY: 0,
  },
  fanGrille: {
    radius: 32,
    holeRadius: 3,
    rings: 3,
    borderInset: 6,
    screwRadius: 2,
    screwSpacingY: 36,
    screwSpacingX: 28,
  },
  // Laid out from back-ports.jpg (a real close-up of the rear face). The
  // photo itself is landscape; the model's rear (-Z) face is portrait
  // (width 65 x height 125), so the photo is mapped on 90deg clockwise:
  // photo-right -> model-bottom, photo-top -> model-right, photo-left ->
  // model-top. See REFERENCES.md for the full reasoning.
  ports: [
    {
      id: 'camera',
      label: 'Camera',
      position: [15, 15],
      width: 17,
      height: 1.5,
    },
    { id: 'lan', label: 'LAN', position: [-15, -2.5], width: 13, height: 13 },
    {
      id: 'usb3-1',
      label: 'USB 3.0',
      position: [1.5, 3.5],
      width: 11,
      height: 7.5,
    },
    {
      id: 'usb3-2',
      label: 'USB 3.0',
      position: [1.5, -8],
      width: 11,
      height: 7.5,
    },
    {
      id: 'usb2-1',
      label: 'USB 2.0',
      position: [17.5, 3.5],
      width: 11,
      height: 7.5,
    },
    {
      id: 'usb2-2',
      label: 'USB 2.0',
      position: [17.5, -8],
      width: 11,
      height: 7.5,
    },
    {
      id: 'microsd',
      label: 'Micro SD',
      position: [-13.5, -34],
      width: 12.5,
      height: 2.5,
    },
    { id: 'ssd', label: 'SSD', position: [2, -32], width: 8, height: 5 },
    { id: 'power', label: 'Power', position: [16.5, -32], width: 8, height: 5 },
  ],
  materials: {
    void: '#05070A',
    edgeHighlight: '#02FBFF',
    ledActivity: '#03BEFF',
  },
};
