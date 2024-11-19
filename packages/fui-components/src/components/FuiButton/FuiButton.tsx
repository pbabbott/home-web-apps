import React from 'react';

type ButtonVariant = 'text' | 'contained' | 'outlined';
type ButtonColor = 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'accentPurple' | 'accentFalcon';

export interface FuiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  color?: ButtonColor;
  children: React.ReactNode;
  onClick?: () => void;
}

/** Primary UI component for user interaction */
export const FuiButton: React.FC<FuiButtonProps> = ({
  variant = 'contained',
  color = 'primary',
  children,
  className = '',
  ...props
}) => {
  const getColorClasses = (color: ButtonColor) => {
    const colors = {
      primary: {
        contained: 'bg-blue-600 hover:bg-blue-700 text-white',
        outlined: 'border-blue-600 text-blue-600 hover:bg-blue-50',
        text: 'text-blue-600 hover:bg-blue-50'
      },
      secondary: {
        contained: 'bg-gray-600 hover:bg-gray-700 text-white',
        outlined: 'border-gray-600 text-gray-600 hover:bg-gray-50',
        text: 'text-gray-600 hover:bg-gray-50'
      },
      success: {
        contained: 'bg-green-600 hover:bg-green-700 text-white',
        outlined: 'border-green-600 text-green-600 hover:bg-green-50',
        text: 'text-green-600 hover:bg-green-50'
      },
      error: {
        contained: 'bg-red-600 hover:bg-red-700 text-white',
        outlined: 'border-red-600 text-red-600 hover:bg-red-50',
        text: 'text-red-600 hover:bg-red-50'
      },
      warning: {
        contained: 'bg-yellow-600 hover:bg-yellow-700 text-white',
        outlined: 'border-yellow-600 text-yellow-600 hover:bg-yellow-50',
        text: 'text-yellow-600 hover:bg-yellow-50'
      },
      accentPurple: {
        contained: 'bg-purple-600 hover:bg-purple-700 text-white',
        outlined: 'border-purple-600 text-purple-600 hover:bg-purple-50',
        text: 'text-purple-600 hover:bg-purple-50'
      },
      accentFalcon: {
        contained: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        outlined: 'border-indigo-600 text-indigo-600 hover:bg-indigo-50',
        text: 'text-indigo-600 hover:bg-indigo-50'
      }
    };

    return colors[color][variant as keyof typeof colors[typeof color]] || '';
  };

  const baseClasses = 'px-4 py-2 rounded-md transition-colors';
  const variantClasses = {
    contained: '',
    outlined: 'border',
    text: ''
  };

  return (
    <button
      type="button"
      className={`${baseClasses} ${variantClasses[variant]} ${getColorClasses(color)} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};