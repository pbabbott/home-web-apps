import React from 'react';
import { extendedTwMerge } from '../utils/extendTwMerge';
import { buttonBaseClasses } from './buttonColorTokens';

export interface BaseButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: () => void;
  component?: React.ElementType;
  href?: string;
}

interface BaseButtonInternalProps extends BaseButtonProps {
  /** Fully-resolved color/variant classes from the calling component. */
  colorClasses: string;
}

/** Internal only — not exported from the package. Holds the render/polymorphism
 * plumbing (`component`/`href`, base classes, prop spreading) shared by Button
 * and OutlinedButton, so the two stay structurally identical. */
export function BaseButton({
  children,
  className = '',
  component,
  colorClasses,
  ...props
}: BaseButtonInternalProps) {
  const classes = extendedTwMerge(
    `${buttonBaseClasses} ${colorClasses}`,
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
}
