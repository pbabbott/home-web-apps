import React, { useCallback, useRef } from 'react';
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
import * as RDM from '@radix-ui/react-dropdown-menu';
import { Cross1Icon } from '@radix-ui/react-icons';
import anime from 'animejs';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { Typography } from '../Typography/Typography';
import { DottedDecoration } from './DottedDecoration';

export { DropdownCloseCtx } from './DropdownCloseCtx';

export const DropdownMenu: React.FC<React.ComponentProps<typeof RDM.Root>> = ({
  onOpenChange,
  children,
  ...props
}) => {
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const close = useCallback(() => onOpenChangeRef.current?.(false), []);
  return (
    <DropdownCloseCtx.Provider value={close}>
      <RDM.Root onOpenChange={onOpenChange} {...props}>
        {children}
      </RDM.Root>
    </DropdownCloseCtx.Provider>
  );
};

export const DropdownMenuTrigger = RDM.Trigger;

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

const LBracket = ({
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

export interface DropdownMenuContentProps
  extends React.ComponentProps<typeof RDM.Content> {
  label?: string;
  showClose?: boolean;
  animated?: boolean;
  children?: React.ReactNode;
}

export const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({
  label,
  showClose,
  animated = true,
  className,
  children,
  sideOffset = 8,
  ...props
}) => {
  const animatedRef = useRef(animated);
  animatedRef.current = animated;

  const contentRef = useCallback((el: HTMLDivElement | null) => {
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

  return (
    <RDM.Portal>
      <RDM.Content
        ref={contentRef}
        sideOffset={sideOffset}
        className={extendedTwMerge(
          'relative z-50 min-w-[380px] bg-neutral-900/30 backdrop-blur-sm',
          'border border-primary-700 text-neutral-300 pb-3 px-2',
          className,
        )}
        {...props}
      >
        <LBracket position="top-left" />
        <LBracket position="bottom-left" />
        <LBracket position="bottom-right" />

        {label && (
          <div className="relative flex items-center justify-center px-8 py-2 border-b border-primary-900 text-primary-500 tracking-wider">
            <Typography variant="caption" component="span">
              {label}
            </Typography>
            {showClose && (
              <RDM.Item
                className="absolute right-3 cursor-pointer outline-none hover:text-primary-300 transition-colors"
                aria-label="Close"
              >
                <Cross1Icon />
              </RDM.Item>
            )}
          </div>
        )}
        <div className="flex px-2 py-1">
          <div className="flex-1">{children}</div>
          <DottedDecoration className="text-primary-700 opacity-60 self-center pr-1" />
        </div>
      </RDM.Content>
    </RDM.Portal>
  );
};
