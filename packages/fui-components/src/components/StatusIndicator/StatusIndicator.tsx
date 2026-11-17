import React from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { Typography } from '../Typography/Typography';
import {
  statusIndicatorColorTokens,
  type StatusIndicatorColor,
} from './statusIndicatorColors';

export type { StatusIndicatorColor };

export interface StatusIndicatorProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** The label, left-aligned. */
  children: React.ReactNode;
  /** State color for the dot, status text and accent. Defaults to `success`. */
  color?: StatusIndicatorColor;
  /** Short status text (e.g. `OK`, `OFFLINE`, `503`) shown right-aligned in the
   * state color. Omit for the glowing dot. Color alone is not accessible: for
   * the dot, pass an `aria-label` or `title` describing the state. */
  status?: React.ReactNode;
  /** Gently pulse the dot. Only applies to the dot. Defaults to `true`. */
  pulse?: boolean;
  /** Element to render as. Defaults to `li`. */
  component?: React.ElementType;
}

const pulseKeyframes = `
@keyframes fui-status-pulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50%      { transform: scale(1.12); opacity: 1; }
}
.fui-status-dot-pulse { animation: fui-status-pulse 2.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .fui-status-dot-pulse { animation: none; }
}
`;

/** Row classes: fixed height so stacked rows match, plus a left accent bar and
 * a hairline that fades out to the right (the DataList divider, one-sided). */
const rowClasses =
  'relative flex h-9 items-center gap-3 overflow-hidden bg-neutral-900/60 pl-4 pr-3 before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:bg-[var(--fui-status-accent)] after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-gradient-to-r after:via-transparent after:to-transparent';

/** A fixed-height status row for lists of things that are up or down: a label
 * on the left, a glowing dot (or short colored status text) on the right. */
export const StatusIndicator = React.forwardRef<
  HTMLElement,
  StatusIndicatorProps
>(function StatusIndicator(
  {
    children,
    color = 'success',
    status,
    pulse = true,
    component: Component = 'li',
    className,
    style,
    ...props
  },
  ref,
) {
  const tokens = statusIndicatorColorTokens[color];

  return (
    <Component
      ref={ref}
      data-color={color}
      className={extendedTwMerge(rowClasses, tokens.line, className)}
      style={
        {
          '--fui-status-accent': tokens.accent,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      <Typography
        variant="body2"
        component="span"
        className="min-w-0 flex-1 truncate"
      >
        {children}
      </Typography>
      {status !== undefined ? (
        <Typography
          variant="caption"
          component="span"
          className={extendedTwMerge(
            'shrink-0 uppercase tracking-wider',
            tokens.text,
          )}
        >
          {status}
        </Typography>
      ) : (
        <>
          {pulse && <style>{pulseKeyframes}</style>}
          <span
            aria-hidden="true"
            className={extendedTwMerge(
              'size-2.5 shrink-0 rounded-full',
              tokens.dot,
              pulse && 'fui-status-dot-pulse',
            )}
            style={{ boxShadow: tokens.glow }}
          />
        </>
      )}
    </Component>
  );
});
