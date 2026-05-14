import React from 'react';
import { twMerge } from 'tailwind-merge';
import type { PanelColor } from './types';
import CornerCrosses from './CornerCrosses';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: PanelColor;
}

const getColorClasses = (color: PanelColor) => {
  const colors = {
    default: 'border-neutral-600 text-neutral-50',
    white: 'border-neutral-50 text-neutral-50',
    primary: 'border-primary-500 text-primary-500',
    secondary: 'border-secondary-500 text-secondary-500',
    success: 'border-success-400 text-success-400',
    error: 'border-error-400 text-error-400',
    warning: 'border-warning-400 text-warning-400',
    'accent-purple': 'border-accent-purple-300 text-accent-purple-300',
    'accent-falcon': 'border-accent-falcon-400 text-accent-falcon-400',
  };
  return colors[color] || '';
};

export const Panel: React.FC<PanelProps> = ({
  color = 'default',
  className = '',
  children,
}) => {
  const baseClasses = 'px-4 py-2 transition-colors relative border';

  const classes = twMerge(baseClasses, getColorClasses(color), className);

  return (
    <div className={classes}>
      <CornerCrosses color={color} />
      {children}
    </div>
  );
};
