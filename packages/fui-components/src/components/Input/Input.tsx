import React, { useEffect, useRef, useState, type FocusEvent } from 'react';
import ActiveOrnament from './ActiveOrnament';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import type { InputColor } from './types';
import { getSvgColorClasses } from './ColorHelpers';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  color?: InputColor;
}

const getContainerColorClasses = (color: InputColor) => {
  const colors = {
    default: '',
    primary: '',
  };
  return colors[color] || '';
};

const getInputColorClasses = (color: InputColor) => {
  const colors = {
    default: 'bg-neutral-600 border-neutral-300',
    primary: 'bg-primary-900 border-primary-300 text-neutral-50',
  };
  return colors[color] || '';
};

export const Input: React.FC<InputProps> = ({
  color = 'default',
  onFocus,
  onBlur,
  className,
  ...props
}) => {
  const [isActive, setIsActive] = useState(false);

  const deactivateTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(deactivateTimer.current), []);

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    clearTimeout(deactivateTimer.current);
    setIsActive(true);
    onFocus?.(e);
  };

  // Unmounting the ornament while focus is between two elements makes a
  // focus trap (e.g. a Radix dialog) think the focused element was removed and
  // pull focus back to itself, which breaks Tab. Wait until focus has moved on.
  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    deactivateTimer.current = setTimeout(() => setIsActive(false));
    onBlur?.(e);
  };

  const baseClasses = 'relative';
  const baseInputClasses =
    'border focus:outline-none focus:ring-0 active:outline-none px-2 rounded-none';

  const containerColorClasses = getContainerColorClasses(color);
  const inputColorClasses = getInputColorClasses(color);

  const svgColorClasses = getSvgColorClasses(color);

  const svgHeight = 4;

  return (
    <div className={extendedTwMerge(baseClasses, containerColorClasses)}>
      <input
        className={extendedTwMerge(
          baseInputClasses,
          inputColorClasses,
          className,
        )}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
      <svg
        className="absolute -bottom-[4px] left-0 right-[20px] w-full"
        height={svgHeight}
      >
        <line
          x1="0"
          y1="2"
          x2="100%"
          y2="2"
          className={extendedTwMerge('stroke-2', svgColorClasses.line)}
          shapeRendering="crispEdges"
        />
      </svg>
      {isActive && <ActiveOrnament color={color} />}
    </div>
  );
};
