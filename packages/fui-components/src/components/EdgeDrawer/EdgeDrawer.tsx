import React, { useEffect, useId, useRef, useState } from 'react';
import { Typography } from '../Typography/Typography';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { DottedDecoration } from '../DropdownMenu/DottedDecoration';

export interface EdgeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Panel heading and handle accessible name. */
  title: string;
  /** Arbitrary panel content — the drawer has no opinion on what goes
   * inside, so callers compose whatever rows/controls they need. */
  children: React.ReactNode;
  /** Disable the slide transition, e.g. to respect a reduced-motion
   * preference. Defaults to `true`. */
  animated?: boolean;
  className?: string;
}

const PANEL_WIDTH = 288; // px
const PANEL_SLIDE_MS = 300;
const HANDLE_WIDTH = 32; // px
// Handle bar rows, innermost (closest to the chevron) first. Closed is
// uniformly thin/dim; open ramps each level to its own height/opacity. The
// stagger fans outward from the chevron on open (innermost fires first) and
// reverses on close (outermost fires first, converging back to center).
const BAR_REST = { height: 1, opacity: 0.25 };
const BAR_LEVEL_COUNT = 10;
const BAR_LEVEL_STYLE: { height: number; opacity: number }[] = Array.from(
  { length: BAR_LEVEL_COUNT },
  (_, i) => {
    const t = i / (BAR_LEVEL_COUNT - 1);
    return { height: 1 + Math.round(t * 2), opacity: 0.3 + t * 0.7 };
  },
);
const BAR_STAGGER_MS = 25;
const BAR_TRANSITION_MS = 150;

function barStyle(level: number, open: boolean): React.CSSProperties {
  const { height, opacity } = open ? BAR_LEVEL_STYLE[level] : BAR_REST;
  const delayLevel = open ? level : BAR_LEVEL_COUNT - 1 - level;
  return {
    height,
    opacity,
    transition: `height ${BAR_TRANSITION_MS}ms ease-out, opacity ${BAR_TRANSITION_MS}ms ease-out`,
    transitionDelay: `${delayLevel * BAR_STAGGER_MS}ms`,
  };
}
// Horizontal drag distance (px) before a touch gesture counts as a swipe
// open/close, rather than an incidental brush of the edge.
const SWIPE_THRESHOLD = 48;

// HUD-style corner brackets, drawn as strokes inset from the border (same
// technique as DropdownMenu's LBracket) rather than poking past it like
// Panel's CornerCrosses — that keeps them clean when the panel's own edge
// is flush against the viewport edge in the closed state.
const BRACKET_SIZE = 14;

type BracketPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

const bracketPaths: Record<BracketPosition, string> = {
  'top-left': `M ${BRACKET_SIZE} 0 L 0 0 L 0 ${BRACKET_SIZE}`,
  'top-right': `M 0 0 L ${BRACKET_SIZE} 0 L ${BRACKET_SIZE} ${BRACKET_SIZE}`,
  'bottom-left': `M 0 0 L 0 ${BRACKET_SIZE} L ${BRACKET_SIZE} ${BRACKET_SIZE}`,
  'bottom-right': `M 0 ${BRACKET_SIZE} L ${BRACKET_SIZE} ${BRACKET_SIZE} L ${BRACKET_SIZE} 0`,
};

const bracketPositionClasses: Record<BracketPosition, string> = {
  'top-left': 'top-2 left-2',
  'top-right': 'top-2 right-2',
  'bottom-left': 'bottom-2 left-2',
  'bottom-right': 'bottom-2 right-2',
};

function CornerBracket({ position }: { position: BracketPosition }) {
  return (
    <svg
      width={BRACKET_SIZE}
      height={BRACKET_SIZE}
      viewBox={`0 0 ${BRACKET_SIZE} ${BRACKET_SIZE}`}
      className={extendedTwMerge(
        'absolute text-primary-500',
        bracketPositionClasses[position],
      )}
      stroke="currentColor"
      fill="none"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path d={bracketPaths[position]} />
    </svg>
  );
}

export const EdgeDrawer: React.FC<EdgeDrawerProps> = ({
  open,
  onOpenChange,
  title,
  children,
  animated = true,
  className,
}) => {
  const panelId = useId();
  const handleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // The handle's bar gradient should read as a reaction to the drawer
  // having finished sliding, not as part of the slide itself — so it waits
  // out the panel's own transition before flipping (instantly if that
  // transition is disabled).
  const [barsOpen, setBarsOpen] = useState(open);
  useEffect(() => {
    if (!animated) {
      setBarsOpen(open);
      return;
    }
    const timer = setTimeout(() => setBarsOpen(open), PANEL_SLIDE_MS);
    return () => clearTimeout(timer);
  }, [open, animated]);

  // null = gesture direction not yet determined; true/false once we've seen
  // enough movement to tell a horizontal swipe from a vertical scroll.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const horizontalIntent = useRef<boolean | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    horizontalIntent.current = null;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    if (horizontalIntent.current === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // too small to classify yet
      horizontalIntent.current = Math.abs(dx) > Math.abs(dy);
    }
    // Only steal the gesture from page scroll once it's clearly horizontal.
    if (horizontalIntent.current) {
      e.preventDefault();
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    const wasHorizontal = horizontalIntent.current;
    touchStart.current = null;
    horizontalIntent.current = null;
    if (!start || !wasHorizontal) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    if (dx > SWIPE_THRESHOLD && !open) onOpenChange(true);
    else if (dx < -SWIPE_THRESHOLD && open) onOpenChange(false);
  }

  // Escape closes the drawer and returns focus to the handle.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onOpenChange(false);
        handleRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Move focus into the panel whenever it opens.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <div
      className={extendedTwMerge('fixed left-0 top-1/2 z-40 flex', className)}
      style={{
        transform: `translate(${open ? '0' : `-${PANEL_WIDTH}px`}, -50%)`,
        transition: animated
          ? `transform ${PANEL_SLIDE_MS}ms ease-out`
          : undefined,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={panelRef}
        id={panelId}
        role="region"
        aria-label={title}
        tabIndex={-1}
        className="relative border-y border-r border-primary-700 bg-neutral-900/30 pb-3 outline-none backdrop-blur-sm"
        style={{ width: PANEL_WIDTH }}
      >
        <CornerBracket position="top-left" />
        <CornerBracket position="top-right" />
        <CornerBracket position="bottom-left" />
        <CornerBracket position="bottom-right" />

        <div className="flex items-center gap-2 border-b border-primary-900 px-4 py-2">
          <span
            aria-hidden="true"
            className={extendedTwMerge(
              'h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400',
              open && animated && 'animate-pulse',
              !open && 'opacity-40',
            )}
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <Typography variant="h6" component="h2" className="truncate">
              {title}
            </Typography>
            <Typography
              variant="caption"
              component="span"
              className="text-neutral-500 tracking-[.2em]"
            >
              {open ? 'ACTIVE' : 'STANDBY'}
            </Typography>
          </div>
        </div>

        <div className="flex gap-2 px-4 pt-3">
          <div className="flex flex-1 flex-col gap-3">{children}</div>
          <DottedDecoration className="shrink-0 self-center text-primary-700 opacity-60" />
        </div>
      </div>

      <button
        ref={handleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? `Close ${title}` : `Open ${title}`}
        onClick={() => onOpenChange(!open)}
        className="flex flex-col items-center justify-between border border-l-0 border-primary-500 bg-neutral-1000/95 px-1 py-3 text-primary-400 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
        style={{ width: HANDLE_WIDTH, minHeight: 180 }}
      >
        {BAR_LEVEL_STYLE.map((_, level) => level)
          .reverse()
          .map((level) => (
            <span
              key={`t-${level}`}
              aria-hidden="true"
              className="w-5 bg-primary-400"
              style={barStyle(level, barsOpen)}
            />
          ))}
        <span aria-hidden="true" className="text-lg leading-none">
          {open ? '‹' : '›'}
        </span>
        {BAR_LEVEL_STYLE.map((_, level) => (
          <span
            key={`b-${level}`}
            aria-hidden="true"
            className="w-5 bg-primary-400"
            style={barStyle(level, barsOpen)}
          />
        ))}
      </button>
    </div>
  );
};

export default EdgeDrawer;
