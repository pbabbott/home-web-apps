export type ButtonColor =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'error'
  | 'warning'
  | 'accent-purple'
  | 'accent-falcon'
  | 'neutral';

interface ButtonColorTokens {
  /** contained variant: idle + hover background */
  contained: string;
  /** outlined variant idle: border/text color (no fill) */
  outlinedIdle: string;
  /** text variant idle: text color (no fill) */
  textIdle: string;
  /** the filled look — used statically by OutlinedButton's selected state */
  filled: string;
  /** same look as `filled`, but as literal hover:/group-hover: classes.
   * Written out in full (not derived from `filled` at runtime) because
   * Tailwind's class scanner only matches literal text in source — a
   * programmatically-prefixed class name is invisible to it. */
  filledOnHover: string;
}

export const buttonColorTokens: Record<ButtonColor, ButtonColorTokens> = {
  primary: {
    contained:
      'bg-primary-700 not-disabled:hover:bg-primary-800 not-disabled:group-hover:bg-primary-800',
    outlinedIdle: 'border-primary-500 text-primary-500',
    textIdle: 'text-primary-500',
    filled: 'bg-primary-500 text-black',
    filledOnHover:
      'not-disabled:hover:bg-primary-500 not-disabled:hover:text-black not-disabled:group-hover:bg-primary-500 not-disabled:group-hover:text-black',
  },
  secondary: {
    contained:
      'bg-secondary-600 not-disabled:hover:bg-secondary-700 not-disabled:group-hover:bg-secondary-700',
    outlinedIdle: 'border-secondary-500 text-secondary-500',
    textIdle: 'text-secondary-500',
    filled: 'bg-secondary-500 text-neutral-50',
    filledOnHover:
      'not-disabled:hover:bg-secondary-500 not-disabled:hover:text-neutral-50 not-disabled:group-hover:bg-secondary-500 not-disabled:group-hover:text-neutral-50',
  },
  success: {
    contained:
      'bg-success-500 not-disabled:hover:bg-success-700 not-disabled:group-hover:bg-success-700',
    outlinedIdle: 'border-success-400 text-success-400',
    textIdle: 'text-success-400',
    filled: 'bg-success-400 text-neutral-50',
    filledOnHover:
      'not-disabled:hover:bg-success-400 not-disabled:hover:text-neutral-50 not-disabled:group-hover:bg-success-400 not-disabled:group-hover:text-neutral-50',
  },
  error: {
    contained:
      'bg-error-600 not-disabled:hover:bg-error-700 not-disabled:group-hover:bg-error-700',
    outlinedIdle: 'border-error-400 text-error-400',
    textIdle: 'text-error-400',
    filled: 'bg-error-400 text-neutral-50',
    filledOnHover:
      'not-disabled:hover:bg-error-400 not-disabled:hover:text-neutral-50 not-disabled:group-hover:bg-error-400 not-disabled:group-hover:text-neutral-50',
  },
  warning: {
    contained:
      'bg-warning-500 not-disabled:hover:bg-warning-600 not-disabled:group-hover:bg-warning-600',
    outlinedIdle: 'border-warning-400 text-warning-400',
    textIdle: 'text-warning-400',
    filled: 'bg-warning-400 text-neutral-50',
    filledOnHover:
      'not-disabled:hover:bg-warning-400 not-disabled:hover:text-neutral-50 not-disabled:group-hover:bg-warning-400 not-disabled:group-hover:text-neutral-50',
  },
  'accent-purple': {
    contained:
      'bg-accent-purple-500 not-disabled:hover:bg-accent-purple-600 not-disabled:group-hover:bg-accent-purple-600',
    outlinedIdle: 'border-accent-purple-300 text-accent-purple-300',
    textIdle: 'text-accent-purple-300',
    filled: 'bg-accent-purple-300 text-neutral-50',
    filledOnHover:
      'not-disabled:hover:bg-accent-purple-300 not-disabled:hover:text-neutral-50 not-disabled:group-hover:bg-accent-purple-300 not-disabled:group-hover:text-neutral-50',
  },
  'accent-falcon': {
    contained:
      'bg-accent-falcon-600 not-disabled:hover:bg-accent-falcon-700 not-disabled:group-hover:bg-accent-falcon-700',
    outlinedIdle: 'border-accent-falcon-400 text-accent-falcon-400',
    textIdle: 'text-accent-falcon-400',
    filled: 'bg-accent-falcon-400 text-neutral-50',
    filledOnHover:
      'not-disabled:hover:bg-accent-falcon-400 not-disabled:hover:text-neutral-50 not-disabled:group-hover:bg-accent-falcon-400 not-disabled:group-hover:text-neutral-50',
  },
  neutral: {
    contained:
      'bg-neutral-900 not-disabled:hover:bg-neutral-700 not-disabled:group-hover:bg-neutral-700 border border-neutral-800',
    outlinedIdle: 'border-neutral-700 text-neutral-400',
    textIdle: 'text-neutral-400',
    filled: 'bg-neutral-700 text-neutral-50',
    filledOnHover:
      'not-disabled:hover:bg-neutral-700 not-disabled:hover:text-neutral-50 not-disabled:group-hover:bg-neutral-700 not-disabled:group-hover:text-neutral-50',
  },
};

export type ButtonSize = 'default' | 'small';

export const buttonBaseClasses =
  'transition-colors font-monobit uppercase tracking-[.1em] cursor-pointer no-underline disabled:cursor-not-allowed disabled:opacity-40';

export const buttonSizeClasses: Record<ButtonSize, string> = {
  default: 'px-4 py-2 text-button',
  small: 'px-2.5 py-1 text-caption',
};
