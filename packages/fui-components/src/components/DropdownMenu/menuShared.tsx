import React, { useCallback, useRef } from 'react';
import anime from 'animejs';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { neutral, primary } from '../../tokens/colors';
import { Typography } from '../Typography/Typography';
import { DottedDecoration } from './DottedDecoration';

/**
 * Visual chrome shared by DropdownMenu and Select so both menus look and
 * behave identically: the panel (brackets, label header, dotted rail), item
 * styling, diagonal clip-reveal and the item confirm flash. A look change
 * made here applies to both.
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

const PRIMARY_500 = primary[500];
const NEUTRAL_900 = neutral[900];
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

/** Merges refs so a caller-supplied `ref` doesn't displace the internal one. */
export const composeRefs =
  <T,>(...refs: (React.Ref<T> | undefined)[]) =>
  (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<T | null>).current = node;
    }
  };

/** Classes for the menu surface (Radix Content), minus width/height rules. */
export const menuContentClassName =
  'relative z-50 flex flex-col bg-neutral-900/30 backdrop-blur-sm border border-primary-700 text-neutral-300 pb-3 px-2';

/** Classes for a menu row (Radix Item). */
export const menuItemClassName = extendedTwMerge(
  'flex items-center gap-3 px-3 py-2 text-neutral-300',
  'cursor-pointer outline-none transition-colors duration-200',
  'data-[highlighted]:bg-primary-500 data-[highlighted]:text-neutral-900',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
);

/** The label text inside a menu row. */
export const MenuItemLabel: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => (
  <Typography variant="button" component="span" className="text-inherit grow">
    {children}
  </Typography>
);

interface MenuPanelProps {
  label?: string;
  /** Extra control in the label header (e.g. a close button). */
  headerAction?: React.ReactNode;
  /** Let the body scroll (DropdownMenu); Select scrolls in its Viewport. */
  scrollBody?: boolean;
  children: React.ReactNode;
}

/** Brackets, optional label header, body and dotted rail around menu items. */
export const MenuPanel: React.FC<MenuPanelProps> = ({
  label,
  headerAction,
  scrollBody,
  children,
}) => (
  <>
    <LBracket position="top-left" />
    <LBracket position="bottom-left" />
    <LBracket position="bottom-right" />

    {label && (
      <div className="relative flex items-center justify-center px-8 py-2 border-b border-primary-900 text-primary-500 tracking-wider">
        <Typography variant="caption" component="span">
          {label}
        </Typography>
        {headerAction}
      </div>
    )}
    <div
      className={extendedTwMerge(
        'flex min-h-0 px-2 pb-1',
        scrollBody && 'overflow-y-auto',
        // Without a label header, push items down level with the corner brackets.
        label ? 'pt-1' : 'pt-3',
      )}
    >
      {children}
      <DottedDecoration className="text-primary-700 opacity-60 self-center pr-1" />
    </div>
  </>
);
