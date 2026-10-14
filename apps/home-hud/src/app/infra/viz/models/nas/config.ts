/**
 * Centralized dimensions/materials/detail config for the procedural ASUSTOR
 * NAS model. Change a number here rather than hunting through part
 * components — every part reads its geometry from this file.
 *
 * Coordinate system (applies to every part component in ./parts/):
 *   - Origin is the chassis' geometric center.
 *   - +X = right, +Y = up, +Z = toward the camera / front of the unit.
 *   - Units are millimeters, used directly as Three.js scene units (1 unit
 *     = 1mm). Camera distances in ModelViewer are in the same mm scale.
 *
 * Shape, confirmed against real front/top/rear photos
 * (public/nas-asustor/photos/, see REFERENCES.md): a 6-bay ASUSTOR
 * LOCKERSTOR-style unit, wider than it is tall, with:
 *   - a single horizontal row of 6 drive bays (not a vertical stack),
 *     each latched at the BOTTOM of the tray, not a side tab;
 *   - a header strip above the bays: a brushed left-edge strip (brand +
 *     power/activity LED bars + a USB port near the bottom), and to its
 *     right a recessed display panel plus a 2x2 nav button cluster;
 *   - a large perforated vent covering roughly the rear 2/3 of the top
 *     panel;
 *   - a rear panel with one large circular fan and discrete port cutouts
 *     (power inlet, 2x ethernet, USB, HDMI, Kensington slot) rather than a
 *     generic grille.
 * Exact mm dimensions are still estimated from photo proportions, not
 * measured — correct them further once precise measurements exist.
 *
 * Rendering style: Tron-style technical line art, not a photoreal product
 * shot. Every part renders as a near-invisible "void" fill (for correct
 * hidden-line depth-sorting) traced with a bright line-art outline over
 * every edge — see components/EdgedMesh.tsx. Only two colors: the
 * dominant line color (`materials.edgeHighlight`) and one secondary accent
 * (`materials.ledActivity`), plus tiny flat-color LED dots. See
 * materials.ts and REFERENCES.md.
 */

export interface NasDimensions {
  width: number;
  height: number;
  depth: number;
  /** Wall thickness of the outer chassis shell. */
  wallThickness: number;
}

export interface BayRowConfig {
  count: number;
  bayHeight: number;
  /** Depth of the removable tray bezel (not the full internal bay depth). */
  bezelDepth: number;
  /** Horizontal gap between adjacent bays. */
  gap: number;
  /** Gap between the header's left strip and the first bay (the front photo shows a clear margin here, not bays flush against the strip). */
  rowLeftMargin: number;
  /** Gap between the last bay and the chassis' right edge. */
  rowRightMargin: number;
  /** Distance the bay bezel face sits in front of the chassis front wall. */
  frontOffset: number;
  /** Gap from the bottom of the bay row to the chassis bottom edge. */
  bottomMargin: number;
  /**
   * Bottom-center captive keyhole lock on each tray (a round lock with a
   * small radial slit — not a grip bar or side tab, per the front photo).
   */
  latchRadius: number;
  /** Two small rectangular LED windows near the top of each tray bezel. */
  ledWindowWidth: number;
  ledWindowHeight: number;
  ledWindowGap: number;
  /** Thin metallic trim strip along each tray's vertical edges. */
  trimWidth: number;
}

export interface FasciaConfig {
  /** How far the fascia plate sits in front of the chassis front face. */
  depth: number;
}

export interface HeaderPanelConfig {
  /** Vertical span of the header strip, above the bay row. */
  height: number;
  /** Width of the brushed left-edge strip (brand + LED bars + USB port). */
  leftStripWidth: number;
  /** Brand wordmark, rendered as a canvas-texture plane near the top of the left strip. */
  brandText: string;
  brandWidth: number;
  brandHeight: number;
  ledBarWidth: number;
  ledBarHeight: number;
  ledBarGap: number;
  /** USB port cutout near the bottom of the left strip. */
  usbWidth: number;
  usbHeight: number;
  usbOffsetFromBottom: number;
  /**
   * Recessed glossy display window, right of the left strip. Width is
   * not stored here — computeDisplayWidth() derives it from whatever
   * space is left between the left strip and the button cluster, so it
   * always fills that gap instead of leaving dead bezel or overlapping
   * the buttons if either position is tuned later.
   */
  displayHeight: number;
  displayOffsetX: number;
  /** Gap left between the display's right edge and the button cluster. */
  displayGapBeforeButtons: number;
  /** Bezel frame around the display, slightly larger on every side. */
  displayBezelMargin: number;
  /**
   * 2x2 square nav button cluster, packed tightly (edges nearly touching,
   * just `buttonGap` between them — not spread out) and anchored to the
   * chassis' top-right corner, per the front photo. Button size isn't
   * stored here — computeButtonSize() derives it so the cluster's total
   * height always matches displayHeight exactly (per explicit request),
   * instead of two numbers that have to be hand-kept in sync.
   */
  buttonGap: number;
  buttonClusterRightMargin: number;
  buttonClusterTopMargin: number;
}

export interface TopVentConfig {
  rows: number;
  cols: number;
  holeRadius: number;
  /** Fraction (0-1) of the top panel's depth, from the front, left solid before venting starts. */
  solidFrontFraction: number;
}

/**
 * Perforation grid applied to both the left and right side panels — a
 * rectangular patch (rows=vertical count, cols=front-to-back count),
 * biased toward the front edge rather than centered, per the front photo.
 */
export interface SideVentConfig {
  rows: number;
  cols: number;
  holeRadius: number;
  /** Top/bottom margin as a fraction of chassis height. */
  marginFractionY: number;
  /** Gap from the chassis' front edge to the patch's front edge, as a fraction of chassis depth. */
  frontOffsetFraction: number;
  /** The patch's own front-to-back span, as a fraction of chassis depth. */
  patchDepthFraction: number;
}

export interface RearPortSpec {
  id: string;
  kind: 'ethernet' | 'usb' | 'hdmi' | 'power' | 'kensington';
  /** Position on the rear face, relative to chassis origin, mm. */
  position: [number, number];
  width: number;
  height: number;
  /** HDMI type-A ports are trapezoidal, not rectangular — per the rear photo. */
  shape?: 'rect' | 'trapezoid';
}

export interface ScrewSpec {
  position: [number, number];
  radius: number;
}

export interface RearPanelConfig {
  /** Main case fan: a circular guard ring inside a square, corner-screwed mounting bezel. */
  fanRadius: number;
  fanPosition: [number, number];
  fanBezelSize: number;
  /**
   * Fan guard pattern: concentric ring arcs, each with a gap, rotated to a
   * different angle than its neighbors — a "maze" grille, not radial
   * spokes/blades (that was wrong — corrected per the rear photo).
   */
  fanGuardRingCount: number;
  fanGuardGapDegrees: number;
  fanGuardRingWidth: number;
  /** Non-divisor-of-360 rotation step between adjacent rings' gaps, for an organic offset rather than an even pinwheel. */
  fanGuardRotationStepDegrees: number;
  /** A second, smaller fan built into the PSU module, next to the power inlet. */
  psuFanRadius: number;
  psuFanPosition: [number, number];
  psuFanBezelSize: number;
  /** Small rectangular cover plate near the top-center, between the PSU fan and the port column. */
  topPlateWidth: number;
  topPlateHeight: number;
  topPlatePosition: [number, number];
  ports: RearPortSpec[];
  /** Chassis mounting screws scattered around the panel — see REFERENCES.md for the real layout this follows. */
  screws: ScrewSpec[];
}

export interface FeetConfig {
  radius: number;
  height: number;
  inset: number;
}

export interface DetailConfig {
  /** Show tray latches + LED holes. Turn off for a cheap LOD pass. */
  showTrayDetail: boolean;
}

export interface MaterialColors {
  /** Near-black unlit fill shared by every solid part. */
  void: string;
  /** The one dominant line-art color. */
  edgeHighlight: string;
  /** The one secondary accent color (status LEDs, health). */
  ledPower: string;
  ledActivity: string;
}

export interface NasConfig {
  dimensions: NasDimensions;
  bays: BayRowConfig;
  fascia: FasciaConfig;
  header: HeaderPanelConfig;
  topVent: TopVentConfig;
  sideVent: SideVentConfig;
  rear: RearPanelConfig;
  feet: FeetConfig;
  detail: DetailConfig;
  materials: MaterialColors;
}

export const ASUSTOR_NAS_CONFIG: NasConfig = {
  dimensions: {
    width: 230,
    height: 175,
    depth: 235,
    wallThickness: 2,
  },
  bays: {
    count: 6,
    bayHeight: 100,
    bezelDepth: 6,
    gap: 2,
    rowLeftMargin: 6,
    rowRightMargin: 10,
    frontOffset: 1,
    bottomMargin: 14,
    latchRadius: 4.5,
    ledWindowWidth: 3,
    ledWindowHeight: 2,
    ledWindowGap: 6,
    trimWidth: 2,
  },
  fascia: {
    depth: 3,
  },
  header: {
    height: 52,
    leftStripWidth: 34,
    brandText: 'asustor',
    brandWidth: 30,
    brandHeight: 8,
    ledBarWidth: 20,
    ledBarHeight: 5,
    ledBarGap: 4,
    usbWidth: 12,
    usbHeight: 5,
    usbOffsetFromBottom: 16,
    displayHeight: 34,
    displayOffsetX: 8,
    displayGapBeforeButtons: 6,
    displayBezelMargin: 4,
    buttonGap: 1.5,
    buttonClusterRightMargin: 18,
    buttonClusterTopMargin: 6,
  },
  topVent: {
    rows: 14,
    cols: 16,
    holeRadius: 1.4,
    solidFrontFraction: 0.3,
  },
  sideVent: {
    // Taller-than-wide rectangle (8 rows x 5 cols), biased toward the
    // front edge rather than centered — matches the front photo, which
    // shows the vent patch sitting near the front of the side panel, not
    // centered front-to-back.
    rows: 8,
    cols: 5,
    holeRadius: 1.4,
    marginFractionY: 0.225,
    frontOffsetFraction: 0.05,
    patchDepthFraction: 0.28,
  },
  rear: {
    fanRadius: 62,
    // X coordinates in this whole rear block are mirrored versus a naive
    // "same sign as the photo" guess — viewing the rear face flips
    // left/right relative to the front-facing +X convention (walking
    // around to the back of any object does this), so matching the
    // photo's left-to-right arrangement means negating X throughout.
    fanPosition: [25, -8],
    fanBezelSize: 140,
    fanGuardRingCount: 6,
    fanGuardGapDegrees: 22,
    fanGuardRingWidth: 2,
    fanGuardRotationStepDegrees: 67,
    psuFanRadius: 14,
    psuFanPosition: [55, 62],
    psuFanBezelSize: 34,
    topPlateWidth: 30,
    topPlateHeight: 18,
    topPlatePosition: [-10, 68],
    ports: [
      { id: 'power', kind: 'power', position: [90, 65], width: 22, height: 16 },
      {
        id: 'eth1',
        kind: 'ethernet',
        position: [-78, 48],
        width: 14,
        height: 10,
      },
      {
        id: 'eth2',
        kind: 'ethernet',
        position: [-78, 30],
        width: 14,
        height: 10,
      },
      { id: 'usb', kind: 'usb', position: [-78, 10], width: 14, height: 7 },
      {
        id: 'hdmi',
        kind: 'hdmi',
        position: [-78, -10],
        width: 16,
        height: 7,
        shape: 'trapezoid',
      },
      {
        id: 'kensington',
        kind: 'kensington',
        position: [-78, -50],
        width: 8,
        height: 4,
      },
    ],
    // Approximate scatter matching the rear photo's screw layout — not
    // structurally derived (unlike e.g. the bay row), this is decorative
    // detail, so absolute positions are fine here.
    screws: [
      { position: [15, 68], radius: 1.8 },
      { position: [-35, 68], radius: 1.8 },
      { position: [-65, 72], radius: 1.8 },
      { position: [-95, 72], radius: 1.8 },
      { position: [95, 55], radius: 1.8 },
      { position: [-45, 55], radius: 1.8 },
      { position: [95, -70], radius: 1.8 },
      { position: [-45, -70], radius: 1.8 },
      { position: [95, -78], radius: 1.8 },
      { position: [-95, -78], radius: 1.8 },
    ],
  },
  feet: {
    radius: 7,
    height: 8,
    inset: 20,
  },
  detail: {
    showTrayDetail: true,
  },
  materials: {
    void: '#05070A',
    edgeHighlight: '#02FBFF',
    ledPower: '#03BEFF',
    ledActivity: '#4FA884',
  },
};

/**
 * Derives the width of a single bay from whatever space is left after the
 * header's left strip and the row's left/right margins — so the row
 * always fits, instead of a hardcoded bayWidth drifting out of sync with
 * leftStripWidth as either gets tuned.
 */
export function computeBayWidth(
  config: NasConfig = ASUSTOR_NAS_CONFIG,
): number {
  const { width } = config.dimensions;
  const { leftStripWidth } = config.header;
  const { count, gap, rowLeftMargin, rowRightMargin } = config.bays;
  const available = width - leftStripWidth - rowLeftMargin - rowRightMargin;
  return (available - (count - 1) * gap) / count;
}

/** Derives each bay's center X position (mm, chassis-local), left-to-right. */
export function computeBayPositionsX(
  config: NasConfig = ASUSTOR_NAS_CONFIG,
): number[] {
  const { width } = config.dimensions;
  const { leftStripWidth } = config.header;
  const { count, gap, rowLeftMargin } = config.bays;
  const bayWidth = computeBayWidth(config);
  const rowStartX = -width / 2 + leftStripWidth + rowLeftMargin;
  return Array.from(
    { length: count },
    (_, i) => rowStartX + i * (bayWidth + gap) + bayWidth / 2,
  );
}

/** Total horizontal span occupied by the bay row, mm. */
export function computeBayRowWidth(
  config: NasConfig = ASUSTOR_NAS_CONFIG,
): number {
  const { count, gap } = config.bays;
  const bayWidth = computeBayWidth(config);
  return count * bayWidth + (count - 1) * gap;
}

/** The bay row's (single, shared) center Y position, mm, chassis-local. */
export function computeBayRowY(config: NasConfig = ASUSTOR_NAS_CONFIG): number {
  const { height } = config.dimensions;
  const { bayHeight, bottomMargin } = config.bays;
  return -height / 2 + bottomMargin + bayHeight / 2;
}

/** The nav button cluster's center X position, mm, chassis-local. */
export function computeButtonsCenterX(
  config: NasConfig = ASUSTOR_NAS_CONFIG,
): number {
  const { width } = config.dimensions;
  const { buttonClusterRightMargin } = config.header;
  return width / 2 - buttonClusterRightMargin;
}

/**
 * Derives each button's size so the 2x2 cluster's total height
 * (2*buttonSize + buttonGap) exactly equals displayHeight — the button
 * foursquare should match the LCD's height, not an independently-tuned
 * number that happens to look close.
 */
export function computeButtonSize(
  config: NasConfig = ASUSTOR_NAS_CONFIG,
): number {
  const { displayHeight, buttonGap } = config.header;
  return (displayHeight - buttonGap) / 2;
}

/** The nav button cluster's center Y position, mm, chassis-local — anchored to the top-right corner, not vertically centered in the header. */
export function computeButtonsCenterY(
  config: NasConfig = ASUSTOR_NAS_CONFIG,
): number {
  const { height } = config.dimensions;
  const { buttonClusterTopMargin } = config.header;
  const clusterHeight = config.header.displayHeight;
  return height / 2 - buttonClusterTopMargin - clusterHeight / 2;
}

/** The button cluster's pitch (center-to-center distance) for a tight 2x2 grid. */
export function computeButtonPitch(
  config: NasConfig = ASUSTOR_NAS_CONFIG,
): number {
  const { buttonGap } = config.header;
  return computeButtonSize(config) + buttonGap;
}

/** The display window's left edge, mm, chassis-local (right of the left strip). */
export function computeDisplayLeftEdge(
  config: NasConfig = ASUSTOR_NAS_CONFIG,
): number {
  const { width } = config.dimensions;
  const { leftStripWidth, displayOffsetX } = config.header;
  return -width / 2 + leftStripWidth + displayOffsetX;
}

/**
 * Derives the display's width from whatever space is left between the
 * left strip and the button cluster, so it always fills that gap rather
 * than leaving dead bezel (or overlapping the buttons) if either position
 * is tuned independently later.
 */
export function computeDisplayWidth(
  config: NasConfig = ASUSTOR_NAS_CONFIG,
): number {
  const { displayGapBeforeButtons } = config.header;
  const buttonSize = computeButtonSize(config);
  const buttonPitch = computeButtonPitch(config);
  const buttonsCenterX = computeButtonsCenterX(config);
  const buttonsLeftEdge = buttonsCenterX - buttonPitch / 2 - buttonSize / 2;
  const displayLeftEdge = computeDisplayLeftEdge(config);
  return buttonsLeftEdge - displayGapBeforeButtons - displayLeftEdge;
}
