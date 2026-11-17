import { error, neutral, primary, success, warning } from '../../tokens/colors';

export type StatusIndicatorColor =
  | 'success'
  | 'error'
  | 'warning'
  | 'neutral'
  | 'primary';

interface StatusIndicatorColorTokens {
  /** Dot fill. */
  dot: string;
  /** Glow around the dot (CSS box-shadow). */
  glow: string;
  /** Status text color. */
  text: string;
  /** Left accent bar color (CSS color). */
  accent: string;
  /** Hairline gradient start (fades out to the right). */
  line: string;
}

/** Internal only. Classes are literal so Tailwind's scanner can see them. */
export const statusIndicatorColorTokens: Record<
  StatusIndicatorColor,
  StatusIndicatorColorTokens
> = {
  success: {
    dot: 'bg-success-400',
    glow: `0 0 6px 1px ${success[500]}b3, 0 0 14px 2px ${success[500]}40`,
    text: 'text-success-400',
    accent: success[500],
    line: 'after:from-success-700',
  },
  error: {
    dot: 'bg-error-400',
    glow: `0 0 6px 1px ${error[500]}b3, 0 0 14px 2px ${error[500]}40`,
    text: 'text-error-400',
    accent: error[500],
    line: 'after:from-error-700',
  },
  warning: {
    dot: 'bg-warning-400',
    glow: `0 0 6px 1px ${warning[500]}b3, 0 0 14px 2px ${warning[500]}40`,
    text: 'text-warning-400',
    accent: warning[500],
    line: 'after:from-warning-700',
  },
  neutral: {
    dot: 'bg-neutral-400',
    glow: `0 0 6px 1px ${neutral[500]}b3, 0 0 14px 2px ${neutral[500]}40`,
    text: 'text-neutral-400',
    accent: neutral[500],
    line: 'after:from-neutral-600',
  },
  primary: {
    dot: 'bg-primary-400',
    glow: `0 0 6px 1px ${primary[500]}b3, 0 0 14px 2px ${primary[500]}40`,
    text: 'text-primary-400',
    accent: primary[500],
    line: 'after:from-primary-700',
  },
};
