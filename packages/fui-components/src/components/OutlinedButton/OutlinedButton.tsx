import React from 'react';
import { BaseButton, type BaseButtonProps } from '../BaseButton';
import { buttonColorTokens, type ButtonColor } from '../buttonColorTokens';

export type { ButtonColor };

export interface OutlinedButtonProps extends BaseButtonProps {
  color?: ButtonColor;
  /** Statically applies the hover fill. For toggle-style button groups where
   * this button is the current selection. */
  selected?: boolean;
}

export const OutlinedButton = React.forwardRef<
  HTMLButtonElement,
  OutlinedButtonProps
>(function OutlinedButton(
  { color = 'primary', selected = false, ...props },
  ref,
) {
  const tokens = buttonColorTokens[color];
  const colorClasses = `border ${tokens.outlinedIdle} ${tokens.filledOnHover} ${selected ? tokens.filled : ''}`;

  return <BaseButton ref={ref} colorClasses={colorClasses} {...props} />;
});
