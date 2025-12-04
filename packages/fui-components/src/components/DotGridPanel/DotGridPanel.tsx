import React from 'react';
import { twMerge } from 'tailwind-merge';
import type { DotGridPanelColor } from './types';
import DotGridBackground from './DotGridBackground';

export interface DotGridPanelProps
  extends React.HTMLAttributes<HTMLDivElement> {
  color?: DotGridPanelColor;
}

const getColorClasses = (color: DotGridPanelColor) => {
  const colors = {
    default: 'text-neutral-50',
    white: 'text-neutral-50',
    primary: 'text-primary-500',
    secondary: 'text-secondary-500',
    success: 'text-success-400',
    error: 'text-error-400',
    warning: 'text-warning-400',
    'accent-purple': 'text-accent-purple-300',
    'accent-falcon': 'text-accent-falcon-400',
  };
  return colors[color] || '';
};

export const DotGridPanel: React.FC<DotGridPanelProps> = ({
  color = 'default',
  className = '',
  children,
}) => {
  const baseClasses = 'px-4 py-2 transition-colors relative';

  const classes = twMerge(baseClasses, getColorClasses(color), className);

  return (
    <div className={classes}>
      <DotGridBackground color={color} />
      {children}
    </div>
  );
};
