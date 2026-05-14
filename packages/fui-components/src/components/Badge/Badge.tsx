import React from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import Typography from '../Typography/Typography';

export type BadgeColor =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'error'
  | 'warning'
  | 'accent-purple'
  | 'accent-falcon';

export interface BadgeProps {
  color?: BadgeColor;
  children: React.ReactNode;
  className?: string;
}

const getColorClasses = (color: BadgeColor) => {
  const colors = {
    primary: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
    secondary: 'bg-secondary-500/20 text-secondary-400 border-secondary-500/30',
    success: 'bg-success-500/20 text-success-400 border-success-500/30',
    error: 'bg-error-500/20 text-error-400 border-error-500/30',
    warning: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
    'accent-purple':
      'bg-accent-purple-500/20 text-accent-purple-300 border-accent-purple-500/30',
    'accent-falcon':
      'bg-accent-falcon-500/20 text-accent-falcon-400 border-accent-falcon-500/30',
  };

  return colors[color];
};

export const Badge: React.FC<BadgeProps> = ({
  color = 'primary',
  children,
  className,
}) => {
  const baseClasses = 'inline-block px-3 py-1  rounded-full border';

  const classes = extendedTwMerge(
    baseClasses,
    getColorClasses(color),
    className,
  );

  return (
    <Typography variant="caption" component="span" className={classes}>
      {children}
    </Typography>
  );
};
