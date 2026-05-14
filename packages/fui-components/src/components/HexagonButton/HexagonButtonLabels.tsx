import { CX, CY, COLORS, TRANSITION } from './constants';

// Label layout: SVG <text> doesn't wrap, so the main label is rendered inside a
// <foreignObject> with an HTML div. CSS then handles wrapping (wordWrap, etc.).

// Wide box for short labels (e.g. "SYS", "PWR"). Narrow box for long labels so
// lines wrap sooner, stay clear of the hexagon edges, and look more balanced.
const LABEL_BOX_WIDTH = 76;
const LABEL_BOX_WIDTH_NARROW = 52;
const LABEL_BOX_X = CX - LABEL_BOX_WIDTH / 2;
const LABEL_BOX_X_NARROW = CX - LABEL_BOX_WIDTH_NARROW / 2;

/** True when the label should use the narrow layout and smaller font (wrapping). */
function isLongLabel(label: string): boolean {
  return label.length > 10 || label.includes(' ');
}

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

  const textColor = hovered ? COLORS.textColorHover : COLORS.textColorPrimary;
  const long = label ? isLongLabel(label) : false;

  // Long labels: narrower box (more padding, more even line lengths), taller
  // box (room for 2–3 lines), and smaller font (text-caption).
  const boxWidth = long ? LABEL_BOX_WIDTH_NARROW : LABEL_BOX_WIDTH;
  const boxX = long ? LABEL_BOX_X_NARROW : LABEL_BOX_X;
  const labelBoxHeight = long ? (lowerLabel ? 40 : 44) : lowerLabel ? 32 : 36;
  // Vertically center the label block; when there's a lowerLabel, nudge it up (CY - 6).
  // Long labels get pushed up an extra 4px so they sit higher in the hexagon.
  const labelBoxY =
    (lowerLabel ? CY - 6 - labelBoxHeight / 2 : CY - labelBoxHeight / 2) -
    (long ? 4 : 0);

  return (
    <>
      {label && (
        <foreignObject
          x={boxX}
          y={labelBoxY}
          width={boxWidth}
          height={labelBoxHeight}
          style={{ overflow: 'visible', pointerEvents: 'none' }}
        >
          <div
            className={`font-monobit ${long ? 'text-caption' : 'text-body2'}`}
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'normal',
              color: textColor,
              transition: `color ${TRANSITION}`,
              lineHeight: long ? 0.5 : 1.2,
            }}
          >
            {label}
          </div>
        </foreignObject>
      )}
      {/* Lower label is always short, so plain SVG <text> is enough (no wrapping). */}
      {lowerLabel && (
        <text
          x={CX}
          y={CY + (label ? 14 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-monobit text-caption uppercase tracking-[.05em]"
          fill={textColor}
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
