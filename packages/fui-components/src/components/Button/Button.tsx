import React from 'react';

type ButtonVariant = 'text' | 'contained' | 'outlined';
type ButtonColor = 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'accent-purple' | 'accent-falcon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  color?: ButtonColor;
  children: React.ReactNode;
  onClick?: () => void;
}

const getColorClasses = (variant: ButtonVariant, color: ButtonColor) => {
  const colors = {
    primary: {
      contained: 'bg-primary-700 hover:bg-primary-800 text-white',
      outlined: 'border-primary-500 text-primary-500 hover:bg-primary-500 hover:text-black',
      text: 'text-primary-500 hover:bg-primary-500 hover:text-black'
    },
    secondary: {
      contained: 'bg-secondary-600 hover:bg-secondary-700 text-white',
      outlined: 'border-secondary-500 text-secondary-500 hover:bg-secondary-500 hover:text-white',
      text: 'text-secondary-500 hover:bg-secondary-500 hover:text-white'
    },
    success: {
      contained: 'bg-success-500 hover:bg-success-700 text-white',
      outlined: 'border-success-400 text-success-400 hover:bg-success-400 hover:text-white',
      text: 'text-success-400 hover:bg-success-400 hover:text-white'
    },
    error: {
      contained: 'bg-error-600 hover:bg-error-700 text-white',
      outlined: 'border-error-400 text-error-400 hover:bg-error-400 hover:text-white',
      text: 'text-error-400 hover:bg-error-400 hover:text-white'
    },
    warning: {
      contained: 'bg-warning-500 hover:bg-warning-600 text-white',
      outlined: 'border-warning-400 text-warning-400 hover:bg-warning-400 hover:text-white',
      text: 'text-warning-400 text-warning-400 hover:bg-warning-400 hover:text-white'
    },
    'accent-purple': {
      contained: 'bg-accent-purple-500 hover:bg-accent-purple-600 text-white',
      outlined: 'border-accent-purple-300 text-accent-purple-300 hover:bg-accent-purple-300 hover:text-white',
      text: 'text-accent-purple-300 hover:bg-accent-purple-300 hover:text-white'
    },
    'accent-falcon': {
      contained: 'bg-accent-falcon-600 hover:bg-accent-falcon-700 text-white',
      outlined: 'border-accent-falcon-400 text-accent-falcon-400 hover:bg-accent-falcon-400 hover:text-white',
      text: 'text-accent-falcon-400 hover:bg-accent-falcon-400 hover:text-white'
    }
  };

  return colors[color][variant as keyof typeof colors[typeof color]] || '';
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'contained',
  color = 'primary',
  children,
  className = '',
  ...props
}) => {

  const baseClasses = 'px-4 py-2 transition-colors';
  const variantClasses = {
    contained: '',
    outlined: 'border',
    text: ''
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${getColorClasses(variant, color)} ${className}`
  console.log(classes, color, variant)

  return (
    <button
      type="button"
      className={classes}
      {...props}
    >
      {children}
    </button>
  );
};