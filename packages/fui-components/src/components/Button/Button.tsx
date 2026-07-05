import React from 'react';
import { BaseButton, type BaseButtonProps } from '../BaseButton';
import {
  buttonColorTokens,
  type ButtonColor,
  type ButtonSize,
} from '../buttonColorTokens';

export type { ButtonColor, ButtonSize };
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

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = 'contained', color = 'primary', ...props }, ref) {
    return (
      <BaseButton
        ref={ref}
        colorClasses={getColorClasses(variant, color)}
        {...props}
      />
    );
  },
);
