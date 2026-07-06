'use client';

import { useEffect, useRef, useState } from 'react';
import { extendedTwMerge } from '@abbottland/fui-components';
import anime from 'animejs';

type RevealPhase = 'idle' | 'animating' | 'complete';

export type MaskRevealDirection =
  | 'left-to-right'
  | 'right-to-left'
  | 'top-to-bottom'
  | 'bottom-to-top';

const directionToInset = {
  'left-to-right': (value: number) => `inset(0 ${value}% 0 0)`,
  'right-to-left': (value: number) => `inset(0 0 0 ${value}%)`,
  'top-to-bottom': (value: number) => `inset(${value}% 0 0 0)`,
  'bottom-to-top': (value: number) => `inset(0 0 ${value}% 0)`,
};

// Position of the 1px edge line at the current wipe boundary, keyed the
// same way as directionToInset so the two always stay in sync.
const directionToEdgeStyle: Record<
  MaskRevealDirection,
  (value: number) => React.CSSProperties
> = {
  'left-to-right': (value) => ({ left: `${100 - value}%`, top: 0, bottom: 0 }),
  'right-to-left': (value) => ({
    right: `${100 - value}%`,
    top: 0,
    bottom: 0,
  }),
  'top-to-bottom': (value) => ({ top: `${100 - value}%`, left: 0, right: 0 }),
  'bottom-to-top': (value) => ({
    bottom: `${100 - value}%`,
    left: 0,
    right: 0,
  }),
};

const isVerticalEdge = (direction: MaskRevealDirection) =>
  direction === 'left-to-right' || direction === 'right-to-left';

export interface MaskRevealProps {
  /** When true, runs the mask reveal animation. Runs once when toggled to true. */
  reveal?: boolean;
  /** When false, skips animation and renders children immediately. */
  animated?: boolean;
  /** Called once when the reveal animation finishes. Not called when animated=false. */
  onComplete?: () => void;
  /** Content to be revealed by the mask. */
  children: React.ReactNode;
  /** Animation duration in ms. */
  duration?: number;
  /** Delay before animation starts in ms. */
  delay?: number;
  /** Wipe direction. */
  direction?: MaskRevealDirection;
  className?: string;
  /** Background class painted behind the clip, always fully visible (never
   * itself clipped) so the not-yet-revealed side shows a guaranteed color
   * instead of whatever happens to be behind this component in the page. */
  maskClassName?: string;
  /** When set, draws a 1px line in this color along the current wipe
   * boundary as it animates. */
  edgeColor?: string;
}

export default function MaskReveal({
  reveal = false,
  animated = true,
  onComplete,
  children,
  duration = 1600,
  delay = 200,
  direction = 'left-to-right',
  className,
  maskClassName,
  edgeColor,
}: MaskRevealProps) {
  const maskRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);
  const [phase, setPhase] = useState<RevealPhase>('idle');

  const initialClippedClass =
    direction === 'left-to-right'
      ? '[clip-path:inset(0_100%_0_0)]'
      : direction === 'right-to-left'
        ? '[clip-path:inset(0_0_0_100%)]'
        : direction === 'top-to-bottom'
          ? '[clip-path:inset(100%_0_0_0)]'
          : '[clip-path:inset(0_0_100%_0)]';

  useEffect(() => {
    if (!animated || !reveal || !maskRef.current || hasStartedRef.current)
      return;
    hasStartedRef.current = true;

    const el = maskRef.current;
    const inset = directionToInset[direction];
    const edgeStyle = directionToEdgeStyle[direction];

    const applyEdge = (value: number) => {
      if (!edgeRef.current) return;
      Object.assign(edgeRef.current.style, edgeStyle(value));
    };

    el.style.clipPath = inset(100);
    applyEdge(100);

    const clipValue = { value: 100 };
    anime({
      targets: clipValue,
      value: 0,
      duration,
      delay,
      easing: 'easeOutCubic',
      begin: () => setPhase('animating'),
      update: () => {
        el.style.clipPath = inset(clipValue.value);
        applyEdge(clipValue.value);
      },
      complete: () => {
        // Clear rather than leave inset(0): a lingering clip-path (even a
        // no-op one) makes this div a containing block for fixed-position
        // descendants, breaking iOS Safari's pseudo-fullscreen fallback in
        // DiagramViewer for any content mounted underneath.
        el.style.clipPath = '';
        setPhase('complete');
        onComplete?.();
      },
    });
  }, [animated, reveal, duration, delay, direction, onComplete]);

  const isClipped = animated && phase === 'idle';

  const clippedContent = (
    <div
      ref={maskRef}
      className={extendedTwMerge(isClipped && initialClippedClass, className)}
    >
      {children}
    </div>
  );

  // Preserve the original single-div output when neither extra feature is
  // used, so existing consumers (title reveals, etc.) see no change at all.
  if (!maskClassName && !edgeColor) {
    return clippedContent;
  }

  return (
    <div className="relative">
      {maskClassName && (
        <div className={extendedTwMerge('absolute inset-0', maskClassName)} />
      )}
      {clippedContent}
      {edgeColor && phase === 'animating' && (
        <div
          ref={edgeRef}
          className="absolute pointer-events-none"
          style={{
            backgroundColor: edgeColor,
            ...(isVerticalEdge(direction) ? { width: 1 } : { height: 1 }),
            ...directionToEdgeStyle[direction](100),
          }}
        />
      )}
    </div>
  );
}
