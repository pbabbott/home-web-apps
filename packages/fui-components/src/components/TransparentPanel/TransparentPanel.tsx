import React from 'react';
import { twMerge } from 'tailwind-merge';
import CornerSquares from './CornerSquares';
import type { TransparentPanelColor } from './types';

export interface TransparentPanelProps
  extends React.HTMLAttributes<HTMLDivElement> {
  color?: TransparentPanelColor;
}

const getTransparentColorClasses = (color: TransparentPanelColor) => {
  const colors = {
    default: 'bg-neutral-600/25 text-neutral-50',
    dark: 'bg-neutral-900/30 text-neutral-50',
    white: 'bg-neutral-50/25',
    primary: 'bg-primary-700/25 text-neutral-50',
    secondary: 'bg-secondary-600/25  text-neutral-50',
    success: 'bg-success-500/25  text-neutral-50',
    error: 'bg-error-600/25  text-neutral-50',
    warning: 'bg-warning-500/25  text-neutral-50',
    'accent-purple': 'bg-accent-purple-500/25  text-neutral-50',
    'accent-falcon': 'bg-accent-falcon-600/25 text-neutral-50',
  };
  return colors[color] || '';
};

export const TransparentPanel: React.FC<TransparentPanelProps> = ({
  color = 'default',
  className = '',
  children,
  ...props
}) => {
  // Frosted-glass look: blur whatever is behind the translucent fill and add a
  // faint inset edge (ring, so it doesn't change the box size).
  const baseClasses =
    'px-4 py-2 transition-colors relative backdrop-blur-sm ring-1 ring-inset ring-neutral-300/10';

  const classes = twMerge(
    baseClasses,
    getTransparentColorClasses(color),
    className,
  );

  return (
    <div
      className={classes}
      data-fui="transparent-panel"
      data-color={color}
      {...props}
    >
      <CornerSquares color={color} />
      {children}
    </div>
  );
};
