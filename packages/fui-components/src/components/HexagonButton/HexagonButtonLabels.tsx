import { CX, CY, COLORS, TRANSITION } from './constants';

export interface HexagonButtonLabelsProps {
  label?: string;
  lowerLabel?: string;
  hovered: boolean;
}

export function HexagonButtonLabels({
  label,
  lowerLabel,
  hovered,
}: HexagonButtonLabelsProps) {
  if (!label && !lowerLabel) return null;

  return (
    <>
      {label && (
        <text
          x={CX}
          y={CY - (lowerLabel ? 6 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-monobit text-body2"
          fill={hovered ? COLORS.textColorHover : COLORS.textColorPrimary}
          style={{
            transition: `fill ${TRANSITION}`,
            pointerEvents: 'none',
          }}
        >
          {label}
        </text>
      )}
      {lowerLabel && (
        <text
          x={CX}
          y={CY + (label ? 14 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-monobit text-caption uppercase tracking-[.05em]"
          fill={hovered ? COLORS.textColorHover : COLORS.textColorPrimary}
          style={{
            transition: `fill ${TRANSITION}`,
            pointerEvents: 'none',
          }}
        >
          {lowerLabel}
        </text>
      )}
    </>
  );
}
