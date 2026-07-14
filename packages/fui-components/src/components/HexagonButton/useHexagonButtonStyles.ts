import { COLORS } from './constants';

export interface HexagonButtonStyles {
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  innerGlowOpacity: number;
  innerGlowStroke: string;
  glossOpacity: number;
  shimmerOpacity: number;
  shimmerAnimation: string;
  travelRingOpacity: number;
  travelRing2Opacity: number;
  travelRingStroke: string;
  travelRing2Stroke: string;
  travelRingAnimation: string;
  travelRing2Animation: string;
  svgFilter: string;
}

export function useHexagonButtonStyles(
  active: boolean,
  hovered: boolean,
  animated: boolean = true,
): HexagonButtonStyles {
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionEnabled = animated && !reducedMotion;

  // Hover = warning-based look (amber/orange border, inner glow, fill). Active = "hover" look (shimmer, runner, blue glow).
  const fillColor = hovered
    ? COLORS.hexBgHoverWarning
    : active
      ? COLORS.hexBgHover
      : COLORS.hexBg;
  const borderColor = hovered
    ? COLORS.borderHoverWarning
    : active
      ? COLORS.borderHover
      : COLORS.borderIdle;
  const borderWidth = hovered || active ? 2 : 1.5;
  const innerGlowOpacity = hovered ? 0.9 : active ? 1 : 0;
  const innerGlowStroke = hovered
    ? COLORS.innerGlowStrokeWarning
    : 'transparent';
  const glossOpacity = hovered ? 0.2 : active ? 0.15 : 0.08;
  // Shimmer sweep and travel rings are pure motion effects — suppressed
  // entirely (not just frozen) when !motionEnabled, so a static "selected"
  // state never shows a mid-sweep gradient or a partial dashed ring.
  const shimmerOpacity = active && motionEnabled ? 1 : 0;
  const shimmerAnimation =
    active && motionEnabled ? 'shimmerSweep 2.8s ease-in-out infinite' : 'none';
  const travelRingVisible = active && !hovered && motionEnabled;
  const travelRingOpacity = travelRingVisible ? 1 : 0;
  const travelRing2Opacity = travelRingVisible ? 0.7 : 0;
  const travelRingStroke = COLORS.travelRingStroke;
  const travelRing2Stroke = COLORS.travelRing2Stroke;
  const travelRingAnimation = travelRingVisible
    ? 'travelDash 1.8s linear infinite'
    : 'none';
  const travelRing2Animation = travelRingVisible
    ? 'travelDash 2.6s linear infinite reverse'
    : 'none';
  // Outer drop-shadow only when active (not hovered). On hover we keep glow inside via innerGlow only.
  const svgFilter = active
    ? 'drop-shadow(0 0 10px rgba(0, 212, 255, 0.5)) drop-shadow(0 0 22px rgba(0, 212, 255, 0.2))'
    : 'none';

  return {
    fillColor,
    borderColor,
    borderWidth,
    innerGlowOpacity,
    innerGlowStroke,
    glossOpacity,
    shimmerOpacity,
    shimmerAnimation,
    travelRingOpacity,
    travelRing2Opacity,
    travelRingStroke,
    travelRing2Stroke,
    travelRingAnimation,
    travelRing2Animation,
    svgFilter,
  };
}
