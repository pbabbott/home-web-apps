import { primary, success, warning } from '../../tokens/colors';

function hexPoints(cx: number, cy: number, r: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
}

function pointsToString(pts: [number, number][]): string {
  return pts.map((p) => p.join(',')).join(' ');
}

export const CX = 60;
export const CY = 60;
export const R = 52;
export const STROKE_R = 50;
export const PERIMETER_APPROX = 6 * STROKE_R;

export const outerPolyStr = pointsToString(hexPoints(CX, CY, R));
export const borderPolyStr = pointsToString(hexPoints(CX, CY, STROKE_R));
export const innerGlowPtsStr = pointsToString(hexPoints(CX, CY, STROKE_R - 5));

export const COLORS = {
  textColorPrimary: primary[300],
  textColorHover: warning[300],
  travelRingStroke: primary[300],
  travelRing2Stroke: primary[300],
  hexBg: 'rgba(23, 24, 25, 0.72)', // neutral 1000 + alpha
  hexBgHover: 'rgba(0, 27, 36, 0.82)', // primary[950] + alpha
  hexBgActive: 'rgba(0, 47, 64, 0.85)', // primary[900] + alpha
  hexBgHoverWarning: 'rgba(71, 25, 2, 0.85)', // warning[900] + alpha
  borderIdle: primary[700],
  borderHover: primary[300],
  borderActive: success[500],
  borderHoverWarning: warning[500],
  innerGlowStroke: 'rgba(58, 252, 255, 0.25)', // success[500] + alpha
  innerGlowStrokeWarning: 'rgba(249, 132, 7, 0.25)', // warning[500] + alpha
  glowTeal: 'rgba(58, 252, 255, 0.5)', // success[500] + alpha
} as const;

export const KEYFRAMES_STYLES = `
  @keyframes shimmerSweep {
    0%   { transform: translateX(-100px) skewX(-8deg); opacity: 0; }
    15%  { opacity: 1; }
    85%  { opacity: 1; }
    100% { transform: translateX(100px) skewX(-8deg); opacity: 0; }
  }
  @keyframes travelDash {
    to { stroke-dashoffset: -${PERIMETER_APPROX}; }
  }
`;

export const TRANSITION = '0.4s';
