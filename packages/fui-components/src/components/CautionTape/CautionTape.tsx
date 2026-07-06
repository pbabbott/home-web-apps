import React from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import Typography from '../Typography/Typography';
import { warning, neutral } from '../../tokens/colors';

export interface CautionTapeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  label?: string;
  /** Rotation in degrees. Defaults to a slight tilt so the tape reads as applied, not a perfect banner. */
  angle?: number;
}

const STRIPE_WIDTH = 28; // px, one color band
const STRIPE_PERIOD = STRIPE_WIDTH * 2; // px, one full color cycle along the 45deg gradient axis
// The gradient's period is measured along its own 45deg axis, not along the
// horizontal x-axis we animate. A horizontal shift of STRIPE_PERIOD only
// covers STRIPE_PERIOD * cos(45deg) of that axis, so the loop wraps mid-cycle
// and visibly jumps. Scaling by sqrt(2) (1 / cos(45deg)) lands exactly on a
// full cycle for a seamless loop.
const SCROLL_STEP = STRIPE_PERIOD * Math.SQRT2;
// Bled past the container by one scroll step so translating never exposes a
// gap on the trailing edge.
const BLEED = Math.ceil(SCROLL_STEP);
const SCROLL_DURATION = 9; // s — slow crawl
const GLOW_DURATION = 3.5; // s — slow pulse

export const CautionTape: React.FC<CautionTapeProps> = ({
  label,
  angle = -2,
  className,
  style,
  ...rest
}) => {
  const id = React.useId().replace(/:/g, '');
  const scrollAnim = `caution-tape-scroll-${id}`;
  const glowAnim = `caution-tape-glow-${id}`;

  return (
    <div
      className={extendedTwMerge(
        'absolute inset-x-0 top-1/2 z-10 flex select-none items-center justify-center pointer-events-none opacity-90',
        className,
      )}
      style={{ transform: `translateY(-50%) rotate(${angle}deg)`, ...style }}
      {...rest}
    >
      <style>{`
        @keyframes ${scrollAnim} {
          from { transform: translateX(0); }
          to   { transform: translateX(-${SCROLL_STEP}px); }
        }
        @keyframes ${glowAnim} {
          0%, 100% { box-shadow: 0 0 6px 1px ${warning[400]}66, 0 0 14px 3px ${neutral[900]}40; }
          50%      { box-shadow: 0 0 10px 2px ${warning[400]}99, 0 0 22px 5px ${neutral[900]}66; }
        }
      `}</style>

      <div
        className="relative flex h-10 w-full items-center justify-center overflow-hidden"
        style={{
          animation: `${glowAnim} ${GLOW_DURATION}s ease-in-out infinite`,
        }}
      >
        {/* The fade mask is fixed on this non-moving wrapper (hides the
         * hard-clipped triangular sliver a diagonal stripe would otherwise
         * leave at a straight edge) while the gradient itself scrolls on the
         * bled child below via `transform`, not `background-position` —
         * animating background-position on a repeating diagonal gradient
         * causes visible rasterization seams in Chromium ("funky town"). */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            maskImage:
              'linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)',
          }}
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `calc(100% + ${BLEED}px)`,
              backgroundImage: `repeating-linear-gradient(45deg, ${warning[400]} 0px ${STRIPE_WIDTH}px, ${neutral[900]} ${STRIPE_WIDTH}px ${STRIPE_PERIOD}px)`,
              animation: `${scrollAnim} ${SCROLL_DURATION}s linear infinite`,
            }}
          />
        </div>

        {/* bolt adornments */}
        <span className="absolute left-3 h-2.5 w-2.5 rotate-45 border-2 border-neutral-900/80 bg-neutral-300/80" />
        <span className="absolute right-3 h-2.5 w-2.5 rotate-45 border-2 border-neutral-900/80 bg-neutral-300/80" />

        {label && (
          <Typography
            variant="body2"
            component="span"
            className="relative px-10 py-1 uppercase tracking-[.2em] text-white [text-shadow:0_0_6px_rgba(0,0,0,0.65)]"
          >
            {label}
          </Typography>
        )}
      </div>
    </div>
  );
};

export default CautionTape;
