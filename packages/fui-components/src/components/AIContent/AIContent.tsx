import React from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import Typography from '../Typography/Typography';
import { warning } from '../../tokens/colors';

export interface AIContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Marks this block as AI-generated so it responds to the reader's
   * highlight preference. Purely presentational — this component does not
   * read any preference/context itself, the caller decides. Defaults to
   * `false` so the block renders as plain content until wired up. */
  highlighted?: boolean;
  /** Pulsing glow on the annotation rule/edges instead of a static one.
   * Callers should tie this to the reader's reduced-motion preference.
   * Defaults to `true`. */
  animated?: boolean;
}

const GLOW_DURATION = 2.4; // s — quicker than CautionTape/Badge, this is a thin line not a banner

// Half the label row's line-box height (Typography 'caption': 1.375rem font
// size * .8 line-height / 2), so the stub/vertical-line corner meets the
// label's visual center instead of the row's top edge.
const HEADER_CENTER = '0.55rem';

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
          'relative mb-2',
          highlighted && 'pb-1 pl-5',
          className,
        )}
        {...rest}
      >
        {highlighted && (
          <>
            {pulse && (
              <style>{`
                @keyframes ${glowAnim} {
                  0%, 100% { box-shadow: 0 0 2px 0 ${warning[400]}66; }
                  50%      { box-shadow: 0 0 6px 0 ${warning[400]}CC; }
                }
              `}</style>
            )}
            {/* corner bracket: stub (centered on the label) + full-height
             * left edge + short bottom cap, all meeting at the label's
             * vertical center so the vertical line reads as a continuation
             * of the stub rather than starting underneath the label. */}
            <span
              aria-hidden="true"
              className="absolute left-0 h-px w-3 bg-warning-500/30"
              style={{
                top: HEADER_CENTER,
                ...(pulse && {
                  animation: `${glowAnim} ${GLOW_DURATION}s ease-in-out infinite`,
                }),
              }}
            />
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-0 w-px bg-warning-500/30"
              style={{
                top: HEADER_CENTER,
                ...(pulse && {
                  animation: `${glowAnim} ${GLOW_DURATION}s ease-in-out infinite`,
                }),
              }}
            />
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-0 h-px w-1/4 bg-warning-500/30"
              style={
                pulse
                  ? {
                      animation: `${glowAnim} ${GLOW_DURATION}s ease-in-out infinite`,
                    }
                  : undefined
              }
            />
            <div className="mb-1 flex items-center gap-2">
              <Typography
                variant="caption"
                component="span"
                className="shrink-0 text-warning-400/70 tracking-[.2em]"
              >
                AI-GENERATED
              </Typography>
              <span
                aria-hidden="true"
                className="h-px flex-1 bg-warning-500/30"
                style={
                  pulse
                    ? {
                        animation: `${glowAnim} ${GLOW_DURATION}s ease-in-out infinite`,
                      }
                    : undefined
                }
              />
            </div>
          </>
        )}
        {children}
      </div>
    );
  },
);

export default AIContent;
