import React from 'react';
import { twMerge } from 'tailwind-merge';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { LineWithCircle } from './LineWithCircle';
import { ExpandableLine } from './ExpandableLine';

export type NavItemProps<T extends React.ElementType = 'div'> = {
  as?: T;
  className?: string;
  children?: React.ReactNode;
  icon?: React.ElementType;
  showLeftLine?: boolean;
  showRightLine?: boolean;
  active?: boolean;
} & Omit<
  React.ComponentPropsWithoutRef<T>,
  'as' | 'className' | 'children' | 'icon' | 'showLeftLine' | 'showRightLine'
>;

export const NavItem = <T extends React.ElementType = 'div'>({
  as,
  className = '',
  children,
  icon,
  showLeftLine = true,
  showRightLine = true,
  active = false,
  ...props
}: NavItemProps<T>) => {
  const Component = (as || 'div') as React.ElementType;
  const baseClasses = '';
  const classes = twMerge(baseClasses, className);
  const iconSize = 20;
  const lineHeight = 15;
  const circleRadius = 2;
  const textColor = active ? 'text-primary-700' : 'text-neutral-300';
  const hoverClasses =
    'transition-colors duration-300 group-hover:text-primary-500';

  return (
    <Component
      className={extendedTwMerge(
        `group text-neutral-300 hover:cursor-pointer text-button`,
        classes,
      )}
      {...props}
    >
      <div className="flex flex-row items-end justify-center gap-x-2">
        {showLeftLine ? (
          <LineWithCircle height={lineHeight} circleRadius={circleRadius} />
        ) : (
          <div style={{ width: 1, height: lineHeight }} />
        )}
        {icon &&
          React.createElement(icon, {
            width: iconSize,
            height: iconSize,
            className: extendedTwMerge(textColor, hoverClasses),
          })}
        <span className={extendedTwMerge(textColor, hoverClasses)}>
          {children}
        </span>

        {showRightLine ? (
          <LineWithCircle height={lineHeight} circleRadius={circleRadius} />
        ) : (
          <div style={{ width: 1, height: lineHeight }} />
        )}
      </div>
      <div className="">
        <ExpandableLine strokeWidth={1} />
      </div>

      <div className={`relative top-[3px] ${textColor} ${hoverClasses}`}>
        <ExpandableLine strokeWidth={2} />
      </div>
    </Component>
  );
};
