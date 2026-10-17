/**
 * Centralized dimensions/materials/colors for the procedural Beelink SER5
 * (Ryzen 5 5500U mini PC) model. Change a number here, not in a part file.
 *
 * Coordinate system (matches every other model in this collection — see
 * models/nas/config.ts): origin is the chassis' geometric center, +X =
 * right, +Y = up, +Z = toward the camera / front of the unit. Units are
 * millimeters.
 *
 * Shape is a low, wide box — much wider/deeper than it is tall — unlike
 * the Pironman4's tower. Front I/O is sourced from a real dead-on photo
 * (`photos/front.jpg`); rear I/O, the top vent, and both side vents are
 * reconstructed from a single 3/4 marketing shot (`photos/beelink.jpg`)
 * showing two units — see REFERENCES.md for what's confirmed vs. guessed.
 *
 * Rendering style is the same Tron-style line art as every model in this
 * collection — see docs/home-hud-3d-model-guide.md before changing
 * materials.ts. One exception: the power-button accent is RED (not the
 * usual blue/green family) to match the real hardware's signature red
 * button — see REFERENCES.md "Design decisions".
 */

export interface ChassisConfig {
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  /** Corner cut size for the chamfered (octagonal cross-section) shell — see components/chamfered-box.ts. Small here; the real unit's chamfer is a slim bright trim band, not a deep bevel like the Pironman4. */
  chamfer: number;
}

/** Shared shape for a bordered dot-grid vent panel (top or side face). */
export interface VentPanelConfig {
  rows: number;
  cols: number;
  holeRadius: number;
  /** Border traced just inside the face's own edge. */
  borderInset: number;
  /** Shrinks the panel to this fraction of the face's own width/depth extent, centered. Defaults to 1 (full face) when omitted. */
  widthScale?: number;
  /** Shrinks the panel to this fraction of the face's own height extent, centered. Defaults to 1 (full face) when omitted. */
  heightScale?: number;
}

export interface PortSpec {
  id: string;
  label: string;
  /** [x, y] offset within the port's face (front or rear). */
  position: [number, number];
  width: number;
  height: number;
  /** 'trapezoid' is wider on the bottom edge, narrower on top — used for DP/HDMI, whose real connectors taper rather than being plain rectangles. 'rj45' is a chamfered-bottom-corner body with a small top-center release-clip notch — used for LAN, whose real jack isn't a plain square. */
  shape?: 'rect' | 'circle' | 'trapezoid' | 'rj45';
}

/** The glossy I/O bezel plate — its own small chamfered-corner box, proud of the chassis front face (same technique as the Pironman4's front plate, see createChamferedPanelGeometry). */
export interface FrontBezelConfig {
  width: number;
  height: number;
  depth: number;
  chamfer: number;
}

export interface FrontPanelConfig {
  bezel: FrontBezelConfig;
  /** The I/O row's vertical offset — centered (0) on the face's horizontal midline per explicit correction, see REFERENCES.md. No vent patch and no brand trim/wordmark on this face — both removed per explicit correction, see REFERENCES.md. */
  bezelOffsetY: number;
  ports: PortSpec[];
  buttonRadius: number;
}

export interface MaterialColors {
  void: string;
  edgeHighlight: string;
  /** Power-button glow — red, unlike the blue/green accent every other model in this collection uses. Confirmed deliberate: see REFERENCES.md. */
  ledActivity: string;
  /** The power-symbol icon drawn over the red button — neutral-300 (near-white), matching the real button's white icon. See REFERENCES.md. */
  powerIcon: string;
}

export interface BeelinkSer5Config {
  chassis: ChassisConfig;
  topVent: VentPanelConfig;
  sideVent: VentPanelConfig;
  frontPanel: FrontPanelConfig;
  rearPorts: PortSpec[];
  /** The dark recessed-look surround plaque shared by DP+HDMI, visible in photos/rear.jpg — drawn behind (less proud than) the ports it contains, see parts/RearPanel.tsx. */
  rearShields: { position: [number, number]; width: number; height: number }[];
  /** Three wide horizontal slot grilles across the top of the rear face, above the port row — matches photos/rear.jpg. */
  rearVentSlots: {
    position: [number, number];
    width: number;
    height: number;
  }[];
  materials: MaterialColors;
}

export const BEELINK_SER5_CONFIG: BeelinkSer5Config = {
  chassis: {
    // 126x113x42mm is the only number found anywhere (a rejected reference
    // image for the sibling "SER5 5560U" SKU) — unconfirmed for this
    // 5500U unit, but it's the right ballpark for a squat mini PC and
    // matches the proportions visible in both photos. See SOURCES.md.
    dimensions: {
      width: 126,
      height: 42,
      depth: 113,
    },
    chamfer: 6,
  },
  // Covers most of the top face (the real mesh texture runs edge to edge);
  // bordered per the user's explicit ask ("dots on top and sides contained
  // by a panel"), even though the photo shows no hard frame line.
  topVent: {
    rows: 20,
    cols: 24,
    holeRadius: 0.55,
    borderInset: 4,
  },
  // Side faces are shallow (42mm tall x 113mm deep) — fewer rows than the
  // top, same dot technique, same bordered-panel treatment. Scaled down
  // from the full face per explicit correction (first a uniform 0.5 read
  // too small, then corrected to independent width/height fractions) —
  // see REFERENCES.md.
  sideVent: {
    rows: 8,
    cols: 20,
    holeRadius: 0.5,
    borderInset: 4,
    widthScale: 0.6,
    heightScale: 0.8,
  },
  frontPanel: {
    // No vent patch and no brand trim/wordmark on the front face — both
    // removed per explicit correction (see REFERENCES.md). A rectangular
    // bezel plate with lightly rounded corners holds the I/O row, proud of
    // the chassis front face — matches the glossy bezel strip in
    // front.jpg. Sized to comfortably contain the port row (which spans
    // roughly -19 to +44 in X, -4 to +4 in Y, widest at the power button).
    bezel: {
      width: 108,
      height: 16,
      depth: 1.5,
      chamfer: 3,
    },
    // Centered on the face's own horizontal midline (bezelOffsetY: 0).
    bezelOffsetY: 0,
    buttonRadius: 3.5,
    // Left-to-right order straight off front.jpg: 2x USB 3.0, USB-C, mic
    // pinhole, headphone jack, red power button. Evenly spaced on an
    // 11mm center-to-center pitch and shifted toward the right side of
    // the bezel (leaving open space on the left) per explicit correction
    // — see REFERENCES.md.
    ports: [
      {
        id: 'usb3-1',
        label: 'USB 3.0',
        position: [-15, 0],
        width: 9,
        height: 4,
      },
      {
        id: 'usb3-2',
        label: 'USB 3.0',
        position: [-4, 0],
        width: 9,
        height: 4,
      },
      {
        id: 'usb-c',
        label: 'USB-C',
        position: [7, 0],
        width: 6,
        height: 3,
      },
      {
        id: 'mic',
        label: 'Mic',
        position: [18, 0],
        width: 1.4,
        height: 1.4,
        shape: 'circle',
      },
      {
        id: 'headphone',
        label: 'Headphone',
        position: [29, 0],
        width: 4,
        height: 4,
        shape: 'circle',
      },
      {
        id: 'power',
        label: 'Power',
        position: [40, 0],
        width: 7,
        height: 7,
        shape: 'circle',
      },
    ],
  },
  // Rebuilt from a real dead-on rear photo (photos/rear.jpg, saved by the
  // user) — replaces the earlier reconstruction-from-a-rotated-3/4-shot
  // entirely. Order left-to-right (as seen on a dead-on ?angle=rear
  // render): LAN, USB (3.0 over 2.0, stacked — NOT side by side, a
  // structural correction from the first pass), DisplayPort, HDMI
  // (sharing one recessed-look surround plaque), DC-in. Three wide
  // horizontal slot grilles run across the top of the face, above the
  // port row — also a correction; the first pass had them as tall
  // vertical dividers between port groups, which the photo does not
  // support. X signs are NEGATED relative to a naive read of the photo —
  // viewing the rear (-Z) face mirrors left/right relative to the
  // front-authored +X axis (see docs/home-hud-3d-model-guide.md's
  // rear-face gotcha; confirmed live earlier via a render where LAN, the
  // only square port, showed up on the wrong side before that fix — same
  // sign convention carried forward here). See REFERENCES.md for the
  // full correction log and measured positions.
  rearPorts: [
    {
      id: 'lan',
      label: 'LAN',
      position: [33, -2],
      width: 14,
      height: 14,
      shape: 'rj45',
    },
    {
      id: 'usb-3',
      label: 'USB 3.0',
      position: [14, 1.5],
      width: 11,
      height: 4,
    },
    {
      id: 'usb-2',
      label: 'USB 2.0',
      position: [14, -5.5],
      width: 11,
      height: 4,
    },
    {
      id: 'dp',
      label: 'DisplayPort',
      position: [-6, -2],
      width: 14,
      height: 8,
      shape: 'trapezoid',
    },
    {
      id: 'hdmi',
      label: 'HDMI',
      position: [-25, -2],
      width: 13,
      height: 8,
      shape: 'trapezoid',
    },
    {
      id: 'dc-in',
      label: 'DC In',
      position: [-48, -2],
      width: 8,
      height: 8,
      shape: 'circle',
    },
  ],
  // Tightly wraps DP (x:-6, w:14) + HDMI (x:-25, w:13) with ~1.5mm margin
  // — a tighter fit than the first pass (36x16), which was tall enough to
  // read as overlapping the vent row above it. See REFERENCES.md.
  rearShields: [{ position: [-15, -2], width: 35, height: 11 }],
  // Height bumped from 3 to 5 ("a little taller") and each slot now
  // renders with vertical slat lines (parts/RearPanel.tsx's GrateSlot)
  // so it reads as a grate, not a bare rectangle — per explicit
  // correction, see REFERENCES.md.
  // Height bumped 5 -> 8 and centers evened out to an exact 29mm pitch
  // (symmetric around x: 0, was 29/-1/-29 — a slightly uneven 30/28
  // pitch) per explicit correction, see REFERENCES.md.
  // y nudged 9 -> 10.5 per explicit correction ("translate them up just a
  // bit"); still clear of the flat/chamfer boundary (top edge at
  // 10.5+4=14.5, chamfer starts at 15) — see REFERENCES.md.
  rearVentSlots: [
    { position: [29, 10.5], width: 27, height: 8 },
    { position: [0, 10.5], width: 27, height: 8 },
    { position: [-29, 10.5], width: 27, height: 8 },
  ],
  materials: {
    void: '#05070A',
    edgeHighlight: '#02FBFF',
    ledActivity: '#FF3B30',
    // fui-components neutral-300 — see packages/fui-components/src/tokens/colors.ts.
    // Plain hex literal per this collection's convention (models don't
    // import the token module live) — see docs/home-hud-3d-model-guide.md.
    powerIcon: '#C8D9DE',
  },
};
