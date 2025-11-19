import React from 'react';
import { twMerge } from 'tailwind-merge';
import { extendedTwMerge } from '../../utils/extendTwMerge';

export type NavItemProps<T extends React.ElementType = 'div'> = {
  as?: T;
  className?: string;
  children?: React.ReactNode;
  icon?: React.ElementType;
  showLeftLine?: boolean;
  showRightLine?: boolean;
} & Omit<
  React.ComponentPropsWithoutRef<T>,
  'as' | 'className' | 'children' | 'icon' | 'showLeftLine' | 'showRightLine'
>;

const LineWithCircle = ({
  height = 15,
  stroke = 'currentColor',
  strokeWidth = 1,
  circleRadius = 2.5,
  className = '',
}) => {
  const circleY = circleRadius + strokeWidth;

  return (
    <svg
      width="1"
      height={height}
      className={className}
      viewBox={`0 0 1 ${height}`}
      preserveAspectRatio="xMidYMin meet"
      overflow="visible"
    >
      {/* Vertical line */}
      <line
        x1="0.5"
        y1={circleY}
        x2="0.5"
        y2={height}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />

      {/* Circle at the top */}
      <circle cx="0.5" cy={circleY} r={circleRadius} fill="currentColor" />
    </svg>
  );
};

const ExpandableLine = ({
  stroke = 'currentColor',
  strokeWidth = 2,
  className = '',
}) => {
  const startingWidth = 10;
  return (
    <svg
      className={className}
      width="100%"
      height={strokeWidth}
      viewBox={`0 0 ${startingWidth} ${strokeWidth}`}
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        y1={strokeWidth / 2}
        x2={startingWidth}
        y2={strokeWidth / 2}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
};

export const NavItem = <T extends React.ElementType = 'div'>({
  as,
  className = '',
  children,
  icon,
  showLeftLine = true,
  showRightLine = true,
  ...props
}: NavItemProps<T>) => {
  const Component = (as || 'div') as React.ElementType;
  const baseClasses = '';
  const classes = twMerge(baseClasses, className);
  const iconSize = 20;
  const lineHeight = 15;
  const circleRadius = 2;

  return (
    <div className="text-neutral-300">
      <div className="flex flex-row items-end justify-center gap-x-2">
        {showLeftLine ? (
          <LineWithCircle height={lineHeight} circleRadius={circleRadius} />
        ) : (
          <div style={{ width: 1, height: lineHeight }} />
        )}
        {icon &&
          React.createElement(icon, { width: iconSize, height: iconSize })}
        <Component
          className={extendedTwMerge('text-neutral-300 text-button', classes)}
          {...props}
        >
          {children}
        </Component>
        {showRightLine ? (
          <LineWithCircle height={lineHeight} circleRadius={circleRadius} />
        ) : (
          <div style={{ width: 1, height: lineHeight }} />
        )}
      </div>
      <div className="">
        <ExpandableLine strokeWidth={1} />
      </div>

      <div className="relative top-[4px] ">
        <ExpandableLine strokeWidth={2} />
      </div>
    </div>
  );
};
