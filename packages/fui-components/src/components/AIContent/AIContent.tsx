import React from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { warning } from '../../tokens/colors';

export interface AIContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Marks this block as AI-generated so it responds to the reader's
   * highlight preference. Purely presentational — this component does not
   * read any preference/context itself, the caller decides. Defaults to
   * `false` so the block renders as plain content until wired up. */
  highlighted?: boolean;
  /** Pulsing glow instead of a static highlight. Callers should tie this to
   * the reader's reduced-motion preference. Defaults to `true`. */
  animated?: boolean;
}

// Slow pulse — same cadence family as CautionTape's glow, but gentler since
// this sits inline in body copy rather than as a standalone banner.
const GLOW_DURATION = 3.5; // s

export const AIContent = React.forwardRef<HTMLDivElement, AIContentProps>(
  function AIContent(
    { highlighted = false, animated = true, className, children, ...rest },
    ref,
  ) {
    const id = React.useId().replace(/:/g, '');
    const glowAnim = `ai-content-glow-${id}`;
    const pulse = highlighted && animated;

    return (
      <div
        ref={ref}
        data-ai-content=""
        role={highlighted ? 'note' : undefined}
        aria-label={highlighted ? 'AI-generated content' : undefined}
        className={extendedTwMerge(
          'relative transition-colors duration-300',
          highlighted &&
            'rounded-r border-l-4 border-warning-400 bg-warning-950/20 py-1 pl-4 pr-2',
          className,
        )}
        {...rest}
      >
        {pulse && (
          <style>{`
            @keyframes ${glowAnim} {
              0%, 100% { box-shadow: 0 0 4px 0 ${warning[400]}4D, inset 4px 0 0 -3px ${warning[300]}; }
              50%      { box-shadow: 0 0 14px 2px ${warning[400]}80, inset 4px 0 0 -3px ${warning[200]}; }
            }
          `}</style>
        )}
        {pulse && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-r"
            style={{
              animation: `${glowAnim} ${GLOW_DURATION}s ease-in-out infinite`,
            }}
          />
        )}
        {children}
      </div>
    );
  },
);

export default AIContent;
