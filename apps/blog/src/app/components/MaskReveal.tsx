'use client';

import { useEffect, useRef, useState } from 'react';
import { extendedTwMerge } from '@abbottland/fui-components';
import anime from 'animejs';

type RevealPhase = 'idle' | 'animating' | 'complete';

export type MaskRevealDirection = 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top';

const directionToInset = {
  'left-to-right': (value: number) => `inset(0 ${value}% 0 0)`,
  'right-to-left': (value: number) => `inset(0 0 0 ${value}%)`,
  'top-to-bottom': (value: number) => `inset(${value}% 0 0 0)`,
  'bottom-to-top': (value: number) => `inset(0 0 ${value}% 0)`,
};

export interface MaskRevealProps {
  /** When true, runs the mask reveal animation. Runs once when toggled to true. */
  reveal?: boolean;
  /** Content to be revealed by the mask. */
  children: React.ReactNode;
  /** Animation duration in ms. */
  duration?: number;
  /** Delay before animation starts in ms. */
  delay?: number;
  /** Wipe direction. */
  direction?: MaskRevealDirection;
  className?: string;
}

export default function MaskReveal({
  reveal = false,
  children,
  duration = 1600,
  delay = 200,
  direction = 'left-to-right',
  className,
}: MaskRevealProps) {
  const maskRef = useRef<HTMLDivElement>(null);
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
    if (!reveal || !maskRef.current || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const el = maskRef.current;
    const inset = directionToInset[direction];
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
      },
    });
  }, [reveal, duration, delay, direction]);

  const isClipped = phase === 'idle';

  return (
    <div
      ref={maskRef}
      className={extendedTwMerge(isClipped && initialClippedClass, className)}
    >
      {children}
    </div>
  );
}
