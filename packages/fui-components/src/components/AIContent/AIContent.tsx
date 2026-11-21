import React from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import Typography from '../Typography/Typography';
import { accentFalcon, neutral, primary } from '../../tokens/colors';

export interface AIContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Marks this block as written with AI so it responds to the reader's
   * highlight preference. Purely presentational — this component does not
   * read any preference/context itself, the caller decides. Defaults to
   * `false` so the block renders as plain content until wired up. */
  highlighted?: boolean;
  /** Pulsing glow on the annotation rule/edges instead of a static one.
   * Callers should tie this to the reader's reduced-motion preference.
   * Defaults to `true`. */
  animated?: boolean;
}

// Shared by the text mask and the header rule so they stay in step with the
// blog title treatment.
const AI_GRADIENT = `linear-gradient(to right, ${primary[500]}, ${neutral[50]}, ${accentFalcon[300]})`;

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
        aria-label={highlighted ? 'Written with AI' : undefined}
        className={extendedTwMerge(
          'relative mb-2',
          highlighted && 'pb-1',
          className,
        )}
        {...rest}
      >
        {highlighted && (
          <>
            {pulse && (
              <style>{`
                @keyframes ${glowAnim} {
                  0%, 100% { box-shadow: 0 0 2px 0 ${primary[400]}66; }
                  50%      { box-shadow: 0 0 6px 0 ${primary[400]}CC; }
                }
              `}</style>
            )}
            {/* Hangs in the left margin (negative offset) so the content
             * keeps the same left edge as surrounding text.
             * corner bracket: stub (centered on the label) + full-height
             * left edge + short bottom cap, all meeting at the label's
             * vertical center so the vertical line reads as a continuation
             * of the stub rather than starting underneath the label. */}
            <span
              aria-hidden="true"
              className="absolute -left-5 h-px w-3 bg-primary-500/40"
              style={{
                top: HEADER_CENTER,
                ...(pulse && {
                  animation: `${glowAnim} ${GLOW_DURATION}s ease-in-out infinite`,
                }),
              }}
            />
            <span
              aria-hidden="true"
              className="absolute bottom-0 -left-5 w-px bg-primary-500/40"
              style={{
                top: HEADER_CENTER,
                ...(pulse && {
                  animation: `${glowAnim} ${GLOW_DURATION}s ease-in-out infinite`,
                }),
              }}
            />
            <span
              aria-hidden="true"
              className="absolute bottom-0 -left-5 h-px w-1/4 bg-primary-500/40"
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
                className="shrink-0 text-primary-400/80 tracking-[.2em]"
              >
                WRITTEN WITH AI
              </Typography>
              <span
                aria-hidden="true"
                className="h-px flex-1"
                style={{
                  backgroundImage: AI_GRADIENT,
                  opacity: 0.5,
                  ...(pulse && {
                    animation: `${glowAnim} ${GLOW_DURATION}s ease-in-out infinite`,
                  }),
                }}
              />
            </div>
          </>
        )}
        <div
          data-ai-content-body=""
          // Highlighted text takes the blog-title gradient: the gradient is
          // painted on this box and clipped to the glyphs. Typography sets
          // its own text color, so every descendant is forced transparent.
          className={
            highlighted
              ? 'bg-clip-text text-transparent [&_*]:text-transparent'
              : 'contents'
          }
          style={
            highlighted
              ? {
                  backgroundImage: AI_GRADIENT,
                }
              : undefined
          }
        >
          {children}
        </div>
      </div>
    );
  },
);

export default AIContent;
