import { useCallback, useRef } from 'react';
import anime from 'animejs';

/**
 * Visual chrome shared by DropdownMenu and Select so both menus look and
 * behave identically: corner brackets, diagonal clip-reveal, item flash.
 */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const diagonalPolygon = (t: number): string => {
  if (t <= 0.5) {
    const topX = (1 - 2 * t) * 100;
    const rightY = 2 * t * 100;
    return `polygon(${topX}% 0%, 100% 0%, 100% ${rightY}%)`;
  }
  const botX = (2 - 2 * t) * 100;
  const leftY = (2 * t - 1) * 100;
  return `polygon(0% 0%, 100% 0%, 100% 100%, ${botX}% 100%, 0% ${leftY}%)`;
};

const BRACKET_SIZE = 14;

export const LBracket = ({
  position,
}: {
  position: 'top-left' | 'bottom-right' | 'bottom-left';
}) => {
  const s = BRACKET_SIZE;
  const paths: Record<typeof position, string> = {
    'top-left': `M ${s} 0 L 0 0 L 0 ${s}`,
    'bottom-right': `M 0 ${s} L ${s} ${s} L ${s} 0`,
    'bottom-left': `M 0 0 L 0 ${s} L ${s} ${s}`,
  };
  const posClasses: Record<typeof position, string> = {
    'top-left': 'top-2 left-2',
    'bottom-right': 'bottom-2 right-2',
    'bottom-left': 'bottom-2 left-2',
  };
  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      className={`absolute ${posClasses[position]} text-primary-500`}
      stroke="currentColor"
      fill="none"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path d={paths[position]} />
    </svg>
  );
};

/** Ref callback that plays the diagonal clip-path reveal once on mount. */
export const useClipReveal = (animated: boolean) => {
  const animatedRef = useRef(animated);
  animatedRef.current = animated;

  return useCallback((el: HTMLDivElement | null) => {
    if (!el || (el as HTMLDivElement & { __animated?: boolean }).__animated)
      return;
    (el as HTMLDivElement & { __animated?: boolean }).__animated = true;

    if (!animatedRef.current || prefersReducedMotion()) return;

    const tVal = { value: 0 };
    el.style.clipPath = diagonalPolygon(0);
    anime({
      targets: tVal,
      value: 1,
      duration: 600,
      delay: 0,
      easing: 'easeOutCubic',
      update: () => {
        el.style.clipPath = diagonalPolygon(tVal.value);
      },
      complete: () => {
        el.style.clipPath = '';
      },
    });
  }, []);
};

const PRIMARY_500 = '#3AFCFF';
const NEUTRAL_900 = '#23272B';
const FLASH_MS = 75;
const FLASH_COUNT = 2;

/** Plays the confirm flash, then calls `onDone`. Returns a cancel function. */
export const flashItem = (el: HTMLElement, onDone: () => void) => {
  let count = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reset = () => {
    el.style.backgroundColor = '';
    el.style.color = '';
  };
  const on = () => {
    el.style.backgroundColor = PRIMARY_500;
    el.style.color = NEUTRAL_900;
  };
  const off = () => {
    el.style.backgroundColor = NEUTRAL_900;
    el.style.color = PRIMARY_500;
  };
  const tick = () => {
    if (count >= FLASH_COUNT) {
      reset();
      timer = setTimeout(onDone, 20);
      return;
    }
    on();
    timer = setTimeout(() => {
      off();
      timer = setTimeout(() => {
        count++;
        tick();
      }, FLASH_MS);
    }, FLASH_MS);
  };
  tick();
  return () => {
    clearTimeout(timer);
    reset();
  };
};
