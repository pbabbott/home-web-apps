import React from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';

interface DottedDecorationProps {
  className?: string;
}

const DOT_COLS = 3;
const DOT_ROWS = 6;
const DOT_R = 1.5;
const DOT_SPACING = 7;
const BULLET_ROWS = 3;
const BULLET_R = 2;
const WIDTH = DOT_COLS * DOT_SPACING + 6;

export const DottedDecoration: React.FC<DottedDecorationProps> = ({
  className,
}) => {
  const gridDots: React.ReactNode[] = [];
  for (let row = 0; row < DOT_ROWS; row++) {
    const opacity = 0.15 + (row / (DOT_ROWS - 1)) * 0.6;
    for (let col = 0; col < DOT_COLS; col++) {
      const cx = 4 + col * DOT_SPACING;
      const cy = 8 + row * DOT_SPACING;
      gridDots.push(
        <circle
          key={`d-${row}-${col}`}
          cx={cx}
          cy={cy}
          r={DOT_R}
          opacity={opacity}
        />,
      );
    }
  }

  const baseY = 8 + DOT_ROWS * DOT_SPACING + 4;
  const bulletCx = 4 + (DOT_COLS - 1) * DOT_SPACING;
  const bullets = Array.from({ length: BULLET_ROWS }, (_, i) => (
    <circle
      key={`b-${i}`}
      cx={bulletCx}
      cy={baseY + i * (BULLET_R * 2 + 4)}
      r={BULLET_R}
    />
  ));

  const totalH = baseY + BULLET_ROWS * (BULLET_R * 2 + 4);

  return (
    <svg
      width={WIDTH}
      height={totalH}
      viewBox={`0 0 ${WIDTH} ${totalH}`}
      fill="currentColor"
      className={extendedTwMerge('shrink-0', className)}
      aria-hidden="true"
    >
      {gridDots}
      {bullets}
    </svg>
  );
};
