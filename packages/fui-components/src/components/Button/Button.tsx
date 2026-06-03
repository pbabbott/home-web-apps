import React from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';

export type ButtonVariant = 'text' | 'contained' | 'outlined';
export type ButtonColor =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'error'
  | 'warning'
  | 'accent-purple'
  | 'accent-falcon'
  | 'neutral';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  color?: ButtonColor;
  children: React.ReactNode;
  onClick?: () => void;
  component?: React.ElementType;
  href?: string;
}

const getColorClasses = (variant: ButtonVariant, color: ButtonColor) => {
  const colors = {
    primary: {
      contained:
        'bg-primary-700 hover:bg-primary-800 group-hover:bg-primary-800',
      outlined:
        'border-primary-500 text-primary-500 hover:bg-primary-500 hover:text-black group-hover:bg-primary-500 group-hover:text-black',
      text: 'text-primary-500 hover:bg-primary-500 hover:text-black group-hover:bg-primary-500 group-hover:text-black',
    },
    secondary: {
      contained:
        'bg-secondary-600 hover:bg-secondary-700 group-hover:bg-secondary-700',
      outlined:
        'border-secondary-500 text-secondary-500 hover:bg-secondary-500 hover:text-neutral-50 group-hover:bg-secondary-500 group-hover:text-neutral-50',
      text: 'text-secondary-500 hover:bg-secondary-500 hover:text-neutral-50 group-hover:bg-secondary-500 group-hover:text-neutral-50',
    },
    success: {
      contained:
        'bg-success-500 hover:bg-success-700 group-hover:bg-success-700',
      outlined:
        'border-success-400 text-success-400 hover:bg-success-400 hover:text-neutral-50 group-hover:bg-success-400 group-hover:text-neutral-50',
      text: 'text-success-400 hover:bg-success-400 hover:text-neutral-50 group-hover:bg-success-400 group-hover:text-neutral-50',
    },
    error: {
      contained: 'bg-error-600 hover:bg-error-700 group-hover:bg-error-700',
      outlined:
        'border-error-400 text-error-400 hover:bg-error-400 hover:text-neutral-50 group-hover:bg-error-400 group-hover:text-neutral-50',
      text: 'text-error-400 hover:bg-error-400 hover:text-neutral-50 group-hover:bg-error-400 group-hover:text-neutral-50',
    },
    warning: {
      contained:
        'bg-warning-500 hover:bg-warning-600 group-hover:bg-warning-600',
      outlined:
        'border-warning-400 text-warning-400 hover:bg-warning-400 hover:text-neutral-50 group-hover:bg-warning-400 group-hover:text-neutral-50',
      text: 'text-warning-400 text-warning-400 hover:bg-warning-400 hover:text-neutral-50 group-hover:bg-warning-400 group-hover:text-neutral-50',
    },
    'accent-purple': {
      contained:
        'bg-accent-purple-500 hover:bg-accent-purple-600 group-hover:bg-accent-purple-600',
      outlined:
        'border-accent-purple-300 text-accent-purple-300 hover:bg-accent-purple-300 hover:text-neutral-50 group-hover:bg-accent-purple-300 group-hover:text-neutral-50',
      text: 'text-accent-purple-300 hover:bg-accent-purple-300 hover:text-neutral-50 group-hover:bg-accent-purple-300 group-hover:text-neutral-50',
    },
    'accent-falcon': {
      contained:
        'bg-accent-falcon-600 hover:bg-accent-falcon-700 group-hover:bg-accent-falcon-700',
      outlined:
        'border-accent-falcon-400 text-accent-falcon-400 hover:bg-accent-falcon-400 hover:text-neutral-50 group-hover:bg-accent-falcon-400 group-hover:text-neutral-50',
      text: 'text-accent-falcon-400 hover:bg-accent-falcon-400 hover:text-neutral-50 group-hover:bg-accent-falcon-400 group-hover:text-neutral-50',
    },
    neutral: {
      contained:
        'bg-neutral-900 hover:bg-neutral-700 group-hover:bg-neutral-700 border border-neutral-800',
      outlined:
        'border-neutral-700 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-50 group-hover:bg-neutral-700 group-hover:text-neutral-50',
      text: 'text-neutral-400 hover:bg-neutral-700 hover:text-neutral-50 group-hover:bg-neutral-700 group-hover:text-neutral-50',
    },
  };

  return colors[color][variant as keyof (typeof colors)[typeof color]] || '';
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'contained',
  color = 'primary',
  children,
  className = '',
  component,
  ...props
}) => {
  const baseClasses =
    'px-4 py-2 transition-colors font-monobit text-button uppercase tracking-[.1em] cursor-pointer no-underline';
  const variantClasses = {
    contained: 'text-neutral-50',
    outlined: 'border',
    text: '',
  };

  const classes = extendedTwMerge(
    `${baseClasses} ${variantClasses[variant]} ${getColorClasses(variant, color)}`,
    className,
  );

  const Component = component ?? 'button';

  return (
    <Component
      {...(!component && { type: 'button' })}
      className={classes}
      {...props}
    >
      {children}
    </Component>
  );
};
