import { useEffect, useRef, useState } from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import anime from 'animejs';

type RevealPhase = 'idle' | 'animating' | 'complete';

type AxisDirection =
  | 'left-to-right'
  | 'right-to-left'
  | 'top-to-bottom'
  | 'bottom-to-top';
type DiagonalDirection =
  | 'top-right-to-bottom-left'
  | 'top-left-to-bottom-right';

export type MaskRevealDirection = AxisDirection | DiagonalDirection;

const isDiagonal = (d: MaskRevealDirection): d is DiagonalDirection =>
  d === 'top-right-to-bottom-left' || d === 'top-left-to-bottom-right';

const axisInset: Record<AxisDirection, (v: number) => string> = {
  'left-to-right': (v) => `inset(0 ${v}% 0 0)`,
  'right-to-left': (v) => `inset(0 0 0 ${v}%)`,
  'top-to-bottom': (v) => `inset(${v}% 0 0 0)`,
  'bottom-to-top': (v) => `inset(0 0 ${v}% 0)`,
};

// Computes clip-path polygon for diagonal wipe at progress t (0→1).
// top-right-to-bottom-left: revealed area grows from TR corner toward BL corner.
// top-left-to-bottom-right: mirror.
const diagonalPolygon = (direction: DiagonalDirection, t: number): string => {
  if (direction === 'top-right-to-bottom-left') {
    if (t <= 0.5) {
      const topX = (1 - 2 * t) * 100;
      const rightY = 2 * t * 100;
      return `polygon(${topX}% 0%, 100% 0%, 100% ${rightY}%)`;
    }
    const botX = (2 - 2 * t) * 100;
    const leftY = (2 * t - 1) * 100;
    return `polygon(0% 0%, 100% 0%, 100% 100%, ${botX}% 100%, 0% ${leftY}%)`;
  }
  // top-left-to-bottom-right
  if (t <= 0.5) {
    const topX = 2 * t * 100;
    const leftY = 2 * t * 100;
    return `polygon(0% 0%, ${topX}% 0%, 0% ${leftY}%)`;
  }
  const botX = (2 * t - 1) * 100;
  const rightY = (2 - 2 * t) * 100;
  return `polygon(0% 0%, 100% 0%, 100% ${rightY}%, ${botX}% 100%, 0% 100%)`;
};

const initialAxisClass: Record<AxisDirection, string> = {
  'left-to-right': '[clip-path:inset(0_100%_0_0)]',
  'right-to-left': '[clip-path:inset(0_0_0_100%)]',
  'top-to-bottom': '[clip-path:inset(100%_0_0_0)]',
  'bottom-to-top': '[clip-path:inset(0_0_100%_0)]',
};

export interface MaskRevealProps {
  reveal?: boolean;
  animated?: boolean;
  onComplete?: () => void;
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  direction?: MaskRevealDirection;
  className?: string;
}

export const MaskReveal = ({
  reveal = false,
  animated = true,
  onComplete,
  children,
  duration = 1600,
  delay = 200,
  direction = 'left-to-right',
  className,
}: MaskRevealProps) => {
  const maskRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);
  const [phase, setPhase] = useState<RevealPhase>('idle');

  const initialClippedClass = isDiagonal(direction)
    ? direction === 'top-right-to-bottom-left'
      ? '[clip-path:polygon(100%_0%,100%_0%,100%_0%)]'
      : '[clip-path:polygon(0%_0%,0%_0%,0%_0%)]'
    : initialAxisClass[direction];

  useEffect(() => {
    if (!animated || !reveal || !maskRef.current || hasStartedRef.current)
      return;
    hasStartedRef.current = true;

    const el = maskRef.current;

    if (isDiagonal(direction)) {
      const tVal = { value: 0 };
      el.style.clipPath = diagonalPolygon(direction, 0);
      anime({
        targets: tVal,
        value: 1,
        duration,
        delay,
        easing: 'easeOutCubic',
        begin: () => setPhase('animating'),
        update: () => {
          el.style.clipPath = diagonalPolygon(direction, tVal.value);
        },
        complete: () => {
          el.style.clipPath = '';
          setPhase('complete');
          onComplete?.();
        },
      });
    } else {
      const inset = axisInset[direction];
      el.style.clipPath = inset(100);
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
        },
        complete: () => {
          el.style.clipPath = inset(0);
          setPhase('complete');
          onComplete?.();
        },
      });
    }
  }, [reveal, duration, delay, direction, onComplete, animated]);

  const isClipped = animated && phase === 'idle';

  return (
    <div
      ref={maskRef}
      className={extendedTwMerge(isClipped && initialClippedClass, className)}
    >
      {children}
    </div>
  );
};
