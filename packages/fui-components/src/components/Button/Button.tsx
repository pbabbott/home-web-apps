import React from 'react';
import { BaseButton, type BaseButtonProps } from '../BaseButton';
import { buttonColorTokens, type ButtonColor } from '../buttonColorTokens';

export type { ButtonColor };
export type ButtonVariant = 'text' | 'contained';

export interface ButtonProps extends BaseButtonProps {
  variant?: ButtonVariant;
  color?: ButtonColor;
}

const getColorClasses = (variant: ButtonVariant, color: ButtonColor) => {
  const tokens = buttonColorTokens[color];

  switch (variant) {
    case 'contained':
      return `text-neutral-50 ${tokens.contained}`;
    case 'text':
      return `${tokens.textIdle} ${tokens.filledOnHover}`;
  }
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'contained',
  color = 'primary',
  ...props
}) => {
  return (
    <BaseButton colorClasses={getColorClasses(variant, color)} {...props} />
  );
};
