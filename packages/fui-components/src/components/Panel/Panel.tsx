import React from 'react';
import { twMerge } from 'tailwind-merge';
import { PanelColor, PanelVariant } from './types';
import CornerSquares from './CornerSquares';
import CornerCrosses from './CornerCrosses';
import DotGridBackground from './DotGridBackground';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: PanelColor;
  variant?: PanelVariant;
}

const getColorClasses = (variant: PanelVariant, color: PanelColor) => {
  const colors = {
    default: {
      transparent: 'bg-neutral-600/60 text-neutral-50',
      outlined: 'border-neutral-600 text-neutral-50',
      dots: 'text-neutral-50',
    },
    white: {
      transparent: 'bg-neutral-50/70',
      outlined: 'border-neutral-50 text-neutral-50',
      dots: 'text-neutral-50',
    },
    primary: {
      transparent: 'bg-primary-700/60 text-neutral-50',
      outlined: 'border-primary-500 text-primary-500',
      dots: 'text-primary-500',
    },
    secondary: {
      transparent: 'bg-secondary-600/60  text-neutral-50',
      outlined: 'border-secondary-500 text-secondary-500',
      dots: 'text-secondary-500',
    },
    success: {
      transparent: 'bg-success-500/60  text-neutral-50',
      outlined: 'border-success-400 text-success-400',
      dots: 'text-success-400',
    },
    error: {
      transparent: 'bg-error-600/60  text-neutral-50',
      outlined: 'border-error-400 text-error-400',
      dots: 'text-error-400',
    },
    warning: {
      transparent: 'bg-warning-500/60  text-neutral-50',
      outlined: 'border-warning-400 text-warning-400',
      dots: 'text-warning-400',
    },
    'accent-purple': {
      transparent: 'bg-accent-purple-500/60  text-neutral-50',
      outlined: 'border-accent-purple-300 text-accent-purple-300',
      dots: 'text-accent-purple-300',
    },
    'accent-falcon': {
      transparent: 'bg-accent-falcon-600/60 text-neutral-50',
      outlined: 'border-accent-falcon-400 text-accent-falcon-400',
      dots: 'text-accent-falcon-400',
    },
  };
  return colors[color][variant as keyof (typeof colors)[typeof color]] || '';
};

export const Panel: React.FC<PanelProps> = ({
  color = 'default',
  variant = 'transparent',
  className = '',
  children,
}) => {
  const baseClasses = 'px-4 py-2 transition-colors relative';
  const variantClasses = {
    transparent: '',
    outlined: 'border',
    dots: '',
  };

  const renderDecorative = () => {
    switch (variant) {
      case 'transparent':
        return <CornerSquares color={color} />;
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
