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
    default: 'bg-neutral-600/60 text-neutral-50',
    dark: 'bg-neutral-900/80 text-neutral-50',
    white: 'bg-neutral-50/70',
    primary: 'bg-primary-700/60 text-neutral-50',
    secondary: 'bg-secondary-600/60  text-neutral-50',
    success: 'bg-success-500/60  text-neutral-50',
    error: 'bg-error-600/60  text-neutral-50',
    warning: 'bg-warning-500/60  text-neutral-50',
    'accent-purple': 'bg-accent-purple-500/60  text-neutral-50',
    'accent-falcon': 'bg-accent-falcon-600/60 text-neutral-50',
  };
  return colors[color] || '';
};

export const TransparentPanel: React.FC<TransparentPanelProps> = ({
  color = 'default',
  className = '',
  children,
  ...props
}) => {
  const baseClasses = 'px-4 py-2 transition-colors relative';

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
