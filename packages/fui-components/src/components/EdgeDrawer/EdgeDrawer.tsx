import React, { useEffect, useId, useRef } from 'react';
import { Typography } from '../Typography/Typography';
import { extendedTwMerge } from '../../utils/extendTwMerge';

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
const HANDLE_WIDTH = 32; // px
// Horizontal drag distance (px) before a touch gesture counts as a swipe
// open/close, rather than an incidental brush of the edge.
const SWIPE_THRESHOLD = 48;

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
        transition: animated ? 'transform 300ms ease-out' : undefined,
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
        className="rounded-r-lg border-y border-r border-primary-700 bg-neutral-1000/95 px-4 py-3 outline-none backdrop-blur-sm"
        style={{ width: PANEL_WIDTH }}
      >
        <Typography variant="h6" component="h2" className="mb-3">
          {title}
        </Typography>
        <div className="flex flex-col gap-3">{children}</div>
      </div>

      <button
        ref={handleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? `Close ${title}` : `Open ${title}`}
        onClick={() => onOpenChange(!open)}
        className="flex items-center justify-center rounded-r-md border border-l-0 border-primary-500 bg-neutral-1000/95 text-primary-400 outline-none transition-colors hover:text-primary-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
        style={{ width: HANDLE_WIDTH, minHeight: 64 }}
      >
        <span aria-hidden="true" className="text-lg leading-none">
          {open ? '‹' : '›'}
        </span>
      </button>
    </div>
  );
};

export default EdgeDrawer;
