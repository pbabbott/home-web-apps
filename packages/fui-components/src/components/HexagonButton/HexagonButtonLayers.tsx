import {
  outerPolyStr,
  borderPolyStr,
  innerGlowPtsStr,
  PERIMETER_APPROX,
  TRANSITION,
} from './constants';
import type { HexagonButtonStyles } from './useHexagonButtonStyles';

export interface HexagonButtonLayersProps extends HexagonButtonStyles {}

export function HexagonButtonLayers(styles: HexagonButtonLayersProps) {
  const {
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
  } = styles;

  return (
    <>
      <polygon
        points={outerPolyStr}
        fill={fillColor}
        style={{ transition: `fill ${TRANSITION}` }}
      />

      <g clipPath="url(#hexClip)">
        <polygon
          points={outerPolyStr}
          fill="url(#shimmerGrad)"
          opacity={shimmerOpacity}
          style={{
            transition: 'opacity 0.3s',
            pointerEvents: 'none',
            animation: shimmerAnimation,
          }}
        />
      </g>

      <g clipPath="url(#hexClip)">
        <polygon
          points={outerPolyStr}
          fill="url(#glossGrad)"
          opacity={glossOpacity}
          style={{
            transition: `opacity ${TRANSITION}`,
            pointerEvents: 'none',
          }}
        />
      </g>

      <polygon
        points={innerGlowPtsStr}
        fill="none"
        stroke={innerGlowStroke}
        strokeWidth={8}
        opacity={innerGlowOpacity}
        style={{
          filter: 'url(#innerGlow)',
          transition: `opacity ${TRANSITION}`,
          pointerEvents: 'none',
        }}
      />

      <polygon
        points={borderPolyStr}
        fill="none"
        stroke={borderColor}
        strokeWidth={borderWidth}
        style={{
          transition: `stroke ${TRANSITION}, stroke-width 0.3s`,
        }}
      />

      <polygon
        points={borderPolyStr}
        fill="none"
        stroke={travelRingStroke}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={`18 ${PERIMETER_APPROX - 18}`}
        strokeDashoffset={0}
        opacity={travelRingOpacity}
        style={{
          filter: 'url(#travelGlow)',
          pointerEvents: 'none',
          transition: 'opacity 0.4s',
          animation: travelRingAnimation,
        }}
      />
      <polygon
        points={borderPolyStr}
        fill="none"
        stroke={travelRing2Stroke}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={`10 ${PERIMETER_APPROX - 10}`}
        strokeDashoffset={-(PERIMETER_APPROX / 2)}
        opacity={travelRing2Opacity}
        style={{
          filter: 'url(#travelGlow)',
          pointerEvents: 'none',
          transition: 'opacity 0.4s',
          animation: travelRing2Animation,
        }}
      />
    </>
  );
}
