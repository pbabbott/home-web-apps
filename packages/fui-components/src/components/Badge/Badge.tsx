import React, { useLayoutEffect, useRef, useState } from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import Typography from '../Typography/Typography';
import {
  neutral,
  primary,
  secondary,
  success,
  error,
  warning,
  accentPurple,
  accentFalcon,
} from '../../tokens/colors';

export type BadgeColor =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'error'
  | 'warning'
  | 'accent-purple'
  | 'accent-falcon'
  | 'dark';

export interface BadgeProps {
  color?: BadgeColor;
  children: React.ReactNode;
  className?: string;
}

const POINT_DEPTH = 10; // px — fixed regardless of badge width

function hexPoints(w: number, h: number): string {
  const p = POINT_DEPTH;
  const mid = h / 2;
  return `${p},0 ${w - p},0 ${w},${mid} ${w - p},${h} ${p},${h} 0,${mid}`;
}

// 8-digit hex opacity suffixes: 33 = 20%, 4D = 30%, 99 = 60%, B8 = 72%
type ColorConfig = { fill: string; stroke: string; textClass: string };

const colorConfig: Record<BadgeColor, ColorConfig> = {
  primary: {
    fill: `${primary[500]}33`,
    stroke: `${primary[500]}4D`,
    textClass: 'text-primary-400',
  },
  secondary: {
    fill: `${secondary[500]}33`,
    stroke: `${secondary[500]}4D`,
    textClass: 'text-secondary-400',
  },
  success: {
    fill: `${success[500]}33`,
    stroke: `${success[500]}4D`,
    textClass: 'text-success-400',
  },
  error: {
    fill: `${error[500]}33`,
    stroke: `${error[500]}4D`,
    textClass: 'text-error-400',
  },
  warning: {
    fill: `${warning[500]}33`,
    stroke: `${warning[500]}4D`,
    textClass: 'text-warning-400',
  },
  'accent-purple': {
    fill: `${accentPurple[500]}33`,
    stroke: `${accentPurple[500]}4D`,
    textClass: 'text-accent-purple-300',
  },
  'accent-falcon': {
    fill: `${accentFalcon[500]}33`,
    stroke: `${accentFalcon[500]}4D`,
    textClass: 'text-accent-falcon-400',
  },
  // Mirrors HexagonButton idle: neutral-1000 fill at 72%, primary-700 border at 60%
  dark: {
    fill: `${neutral[1000]}B8`,
    stroke: `${primary[700]}99`,
    textClass: 'text-primary-300',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  color = 'primary',
  children,
  className,
}) => {
  const { fill, stroke, textClass } = colorConfig[color];
  const containerRef = useRef<HTMLSpanElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    if (containerRef.current) {
      setDims({
        w: containerRef.current.offsetWidth,
        h: containerRef.current.offsetHeight,
      });
    }
  }, [children]);

  const { w, h } = dims;
  const points = w > 0 && h > 0 ? hexPoints(w, h) : undefined;

  return (
    <span ref={containerRef} className="inline-flex relative">
      {/* SVG behind Typography via DOM order; viewBox = actual px so strokeWidth is screen pixels */}
      <svg
        className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
        viewBox={`0 0 ${w} ${h}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {points && (
          <>
            <polygon points={points} fill={fill} />
            <polygon
              points={points}
              fill="none"
              stroke={stroke}
              strokeWidth="1.5"
            />
          </>
        )}
      </svg>
      <Typography
        variant="caption"
        component="span"
        className={extendedTwMerge('relative px-6 py-1', textClass, className)}
      >
        {children}
      </Typography>
    </span>
  );
};
