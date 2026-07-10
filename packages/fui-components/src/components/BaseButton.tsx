import React from 'react';
import { extendedTwMerge } from '../utils/extendTwMerge';
import {
  buttonBaseClasses,
  buttonSizeClasses,
  type ButtonSize,
} from './buttonColorTokens';

export interface BaseButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  component?: React.ElementType;
  href?: string;
  /** Anchor-only attributes, relevant when `component="a"`. */
  target?: string;
  rel?: string;
  size?: ButtonSize;
}

interface BaseButtonInternalProps extends BaseButtonProps {
  /** Fully-resolved color/variant classes from the calling component. */
  colorClasses: string;
}

/** Internal only — not exported from the package. Holds the render/polymorphism
 * plumbing (`component`/`href`, base classes, prop spreading) shared by Button
 * and OutlinedButton, so the two stay structurally identical. */
export const BaseButton = React.forwardRef<
  HTMLButtonElement,
  BaseButtonInternalProps
>(function BaseButton(
  {
    children,
    className = '',
    component,
    colorClasses,
    size = 'default',
    ...props
  },
  ref,
) {
  const classes = extendedTwMerge(
    `${buttonBaseClasses} ${buttonSizeClasses[size]} ${colorClasses}`,
    className,
  );

  const Component = component ?? 'button';

  return (
    <Component
      ref={ref}
      {...(!component && { type: 'button' })}
      className={classes}
      {...props}
    >
      {children}
    </Component>
  );
});
