import React from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';

export interface NavBarProps extends React.HTMLAttributes<HTMLElement> {
  className?: string;
  children?: React.ReactNode;
}

export interface CircleSvgProps {
  size?: number;
  radius?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
}

export function CircleSvg({
  size = 100,
  radius,
  fill = 'currentColor',
  stroke,
  strokeWidth = 0,
  className = '',
}: CircleSvgProps) {
  const circleRadius = radius ?? size / 2 - strokeWidth;
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
    >
      <circle
        cx={center}
        cy={center}
        r={circleRadius}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

export default function BoxWithCornerCircles({
  height = 100,
  stroke = 'currentColor',
  strokeWidth = 2,
  circleRadius = 4,
  className = '',
  top = 0,
}) {
  const rectWidth = 30;
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: `${height}px`,
        display: 'block',
        top: `${top}px`,
      }}
    >
      {/* Rectangle - stretches to fill container width */}
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${rectWidth} ${height}`}
        preserveAspectRatio="none"
      >
        <rect
          x={0}
          y={0}
          width={rectWidth}
          height={height}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Circles at corners - positioned absolutely to stay round */}
      <div
        style={{
          position: 'absolute',
          top: -circleRadius,
          left: -circleRadius,
        }}
      >
        <CircleSvg size={circleRadius * 2} fill={stroke} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: -circleRadius,
          right: -circleRadius,
        }}
      >
        <CircleSvg size={circleRadius * 2} fill={stroke} />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: -circleRadius,
          left: -circleRadius,
        }}
      >
        <CircleSvg size={circleRadius * 2} fill={stroke} />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: -circleRadius,
          right: -circleRadius,
        }}
      >
        <CircleSvg size={circleRadius * 2} fill={stroke} />
      </div>
    </div>
  );
}

export const NavBar: React.FC<NavBarProps> = ({
  className = '',
  children,
  ...props
}) => {
  const baseClasses = '';
  const classes = extendedTwMerge(baseClasses, className);

  return (
    <nav className={classes} {...props}>
      <div className="flex flex-row mb-2">{children}</div>
      <BoxWithCornerCircles
        top={-11}
        height={10}
        circleRadius={2}
        strokeWidth={1}
        className="text-neutral-300"
      />
    </nav>
  );
};
