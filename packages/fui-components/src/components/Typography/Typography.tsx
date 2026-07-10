import React from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';

export type TypographyVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'body1'
  | 'body2'
  | 'button'
  | 'caption'
  | 'small';
export type TypographyComponent =
  | 'p'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'span'
  | 'div'
  | 'label';

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  variant: TypographyVariant;
  component?: TypographyComponent;
  /** Relevant when `component="label"`. */
  htmlFor?: string;
}

export const Typography: React.FC<TypographyProps> = ({
  variant,
  component: Component = 'p',
  className,
  ...rest
}) => {
  const baseClasses = 'text-neutral-50';
  const variantClasses = {
    h1: 'font-ethnocentric text-[2.125rem] sm:text-h1 leading-none uppercase',
    h2: 'font-ethnocentric text-[1.75rem] sm:text-h2 leading-none uppercase',
    h3: 'font-monobit text-h3 uppercase',
    h4: 'font-monobit text-h4 uppercase',
    h5: 'font-monobit text-h5 uppercase',
    h6: 'font-monobit text-h6 uppercase',
    body1: 'font-monobit text-body1',
    body2: 'font-monobit text-body2',
    button: 'font-monobit text-button uppercase tracking-[.1em]',
    caption: 'font-monobit text-caption uppercase tracking-[.05em]',
    small: 'font-monobit  text-small uppercase tracking-[.05em]',
  };

  const classes = extendedTwMerge(
    baseClasses,
    variantClasses[variant],
    className,
  );
  return <Component className={classes} {...rest} />;
};

export default Typography;
