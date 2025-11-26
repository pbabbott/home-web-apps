import React from 'react';
import { twMerge } from 'tailwind-merge';
import type { PanelColor, PanelVariant } from './types';
import CornerCrosses from './CornerCrosses';
import DotGridBackground from './DotGridBackground';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: PanelColor;
  variant?: PanelVariant;
}

const getColorClasses = (variant: PanelVariant, color: PanelColor) => {
  const colors = {
    default: {
      outlined: 'border-neutral-600 text-neutral-50',
      dots: 'text-neutral-50',
    },
    white: {
      outlined: 'border-neutral-50 text-neutral-50',
      dots: 'text-neutral-50',
    },
    primary: {
      outlined: 'border-primary-500 text-primary-500',
      dots: 'text-primary-500',
    },
    secondary: {
      outlined: 'border-secondary-500 text-secondary-500',
      dots: 'text-secondary-500',
    },
    success: {
      outlined: 'border-success-400 text-success-400',
      dots: 'text-success-400',
    },
    error: {
      outlined: 'border-error-400 text-error-400',
      dots: 'text-error-400',
    },
    warning: {
      outlined: 'border-warning-400 text-warning-400',
      dots: 'text-warning-400',
    },
    'accent-purple': {
      outlined: 'border-accent-purple-300 text-accent-purple-300',
      dots: 'text-accent-purple-300',
    },
    'accent-falcon': {
      outlined: 'border-accent-falcon-400 text-accent-falcon-400',
      dots: 'text-accent-falcon-400',
    },
  };
  return colors[color][variant as keyof (typeof colors)[typeof color]] || '';
};

export const Panel: React.FC<PanelProps> = ({
  color = 'default',
  variant = 'outlined',
  className = '',
  children,
}) => {
  const baseClasses = 'px-4 py-2 transition-colors relative';
  const variantClasses = {
    outlined: 'border',
    dots: '',
  };

  const renderDecorative = () => {
    switch (variant) {
      case 'dots':
        return <DotGridBackground color={color} />;
      case 'outlined':
        return <CornerCrosses color={color} />;
      default:
        return null;
    }
  };

  const classes = twMerge(
    baseClasses,
    variantClasses[variant],
    getColorClasses(variant, color),
    className,
  );

  return (
    <div className={classes}>
      {renderDecorative()}
      {children}
    </div>
  );
};
