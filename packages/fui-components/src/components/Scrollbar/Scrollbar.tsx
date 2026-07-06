'use client';

import { primary, neutral } from '../../tokens/colors';

export type ScrollbarProps = {
  height: number;
  width?: number;
  tickCount?: number;
  thumbPosition: number;
  thumbSize: number;
  showDots?: boolean;
  className?: string;
};

const CONTENT_GAP = 3;
const TICK_LENGTH = 6;
const TICK_WIDTH = 2;
const TICK_LINE_GAP = 5;
const THUMB_MIN_HEIGHT = 10;
const LINE_DOT_GAP = 4;
const DOT_RADIUS = 1;

const WIDTH_WITH_DOTS = 24;
const WIDTH_WITHOUT_DOTS = 16;

export function Scrollbar({
  height,
  width,
  tickCount = 20,
  thumbPosition,
  thumbSize,
  showDots = true,
  className,
}: ScrollbarProps) {
  const resolvedWidth =
    width ?? (showDots ? WIDTH_WITH_DOTS : WIDTH_WITHOUT_DOTS);
  const tickStartX = CONTENT_GAP;
  const lineX = tickStartX + TICK_LENGTH + TICK_LINE_GAP;
  const dotCount = Math.round(tickCount * 2.0);

  const clampedSize = Math.min(Math.max(thumbSize, 0), 1);
  const clampedPosition = Math.min(Math.max(thumbPosition, 0), 1 - clampedSize);
  const thumbY = clampedPosition * height;
  const thumbHeight = Math.max(clampedSize * height, THUMB_MIN_HEIGHT);

  return (
    <svg
      className={className}
      width={resolvedWidth}
      height={height}
      viewBox={`0 0 ${resolvedWidth} ${height}`}
      style={{ overflow: 'visible' }}
      role="presentation"
    >
      <line
        x1={lineX}
        y1={0}
        x2={lineX}
        y2={height}
        stroke={neutral[700]}
        strokeWidth={1}
        shapeRendering="crispEdges"
      />
      {Array.from({ length: tickCount }, (_, i) => {
        const y = tickCount > 1 ? (i * height) / (tickCount - 1) : height / 2;
        return (
          <line
            key={i}
            x1={tickStartX}
            y1={y}
            x2={tickStartX + TICK_LENGTH}
            y2={y}
            stroke={neutral[600]}
            strokeWidth={TICK_WIDTH}
            shapeRendering="crispEdges"
          />
        );
      })}
      {showDots &&
        Array.from({ length: dotCount }, (_, i) => {
          const y = ((i + 0.5) * height) / dotCount;
          return (
            <circle
              key={i}
              cx={lineX + LINE_DOT_GAP}
              cy={y}
              r={DOT_RADIUS}
              fill={neutral[600]}
              shapeRendering="crispEdges"
            />
          );
        })}
      <rect
        x={tickStartX}
        y={thumbY}
        width={TICK_LENGTH}
        height={thumbHeight}
        fill={primary[500]}
        style={{ filter: `drop-shadow(0 0 3px ${primary[500]}90)` }}
      />
    </svg>
  );
}
