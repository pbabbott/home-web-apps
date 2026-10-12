'use client';

import { Button, Panel } from '@abbottland/fui-components';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const ZOOM_BUTTON_STEP = 1.2;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
/** Pointer must move this many px before a press counts as a drag (vs. a click on a hex). */
const DRAG_THRESHOLD_PX = 4;
const DOT_GAP = 20;
const DOT_COLOR = '#2E373B';
const DOT_RADIUS = 1.5;

type Point = { x: number; y: number };

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  panStartX: number;
  panStartY: number;
  moved: boolean;
}

interface PanZoomCanvasProps {
  children: ReactNode;
  /** Changing this re-centers the canvas — a new metric/groupBy reshuffles the whole layout. */
  resetKey?: string;
}

function PlusIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <path d="M2 8h12" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <circle cx={8} cy={8} r={5} stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M8 1v3M8 12v3M1 8h3M12 8h3"
        stroke="currentColor"
        strokeWidth={1.5}
      />
    </svg>
  );
}

/**
 * Pan/zoom viewport for the hex map — a plain CSS `transform` on a wrapper div,
 * no react-flow/d3/canvas needed. Hexes stay real `<button>`s; a capture-phase
 * click handler swallows the synthetic click a drag produces so panning across
 * hexes never selects one.
 */
export function PanZoomCanvas({ children, resetKey }: PanZoomCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<DragState | null>(null);

  const recenter = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  // A new metric/groupBy reshuffles the whole layout — snap back to a known,
  // centered position rather than leaving a stale pan/zoom. Adjusted during
  // render (React's documented pattern for resetting state on a prop change)
  // instead of in an effect, so it lands in the same commit as the new layout.
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }

  function zoomAround(nextZoomRaw: number, origin: Point) {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoomRaw));
    setPan((prev) => ({
      x: origin.x - (origin.x - prev.x) * (nextZoom / zoom),
      y: origin.y - (origin.y - prev.y) * (nextZoom / zoom),
    }));
    setZoom(nextZoom);
  }

  function zoomByButton(factor: number) {
    const rect = viewportRef.current?.getBoundingClientRect();
    const origin = rect
      ? { x: rect.width / 2, y: rect.height / 2 }
      : { x: 0, y: 0 };
    zoomAround(zoom * factor, origin);
  }

  // React attaches its onWheel listener as passive (for scroll perf), so
  // preventDefault() from a synthetic handler is silently a no-op — the
  // browser just warns. A native listener registered with passive:false is
  // the documented way to actually block the page from scrolling while we
  // zoom. zoom is a dependency so each tick computes from the latest value.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const origin = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      zoomAround(zoom * Math.exp(-e.deltaY * WHEEL_ZOOM_SENSITIVITY), origin);
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // Drag tracking deliberately avoids setPointerCapture: capturing the
  // pointer on the viewport retargets the *click* that follows pointerup to
  // the viewport itself (per the Pointer Events spec's capture retargeting
  // of compatibility mouse events), so a hex button's own onClick would
  // never fire — not even for a plain, un-dragged click. Tracking the drag
  // with window-level listeners sidesteps that entirely: clicks keep
  // bubbling from whichever element is actually under the cursor, and
  // `handleClickCapture` below (a capture-phase listener, unaffected by any
  // of this) still gets first look at the click to swallow it if it was a
  // drag.
  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    // Primary (left) or auxiliary (middle) button starts a pan. Middle-click
    // normally triggers the browser's autoscroll cursor — prevent that so it
    // reads as a pan instead.
    if (e.button !== 0 && e.button !== 1) return;
    if (e.button === 1) e.preventDefault();
    const drag: DragState = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panStartX: pan.x,
      panStartY: pan.y,
      moved: false,
    };
    dragRef.current = drag;

    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== drag.pointerId) return;
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        drag.moved = true;
      }
      if (drag.moved) {
        setPan({ x: drag.panStartX + dx, y: drag.panStartY + dy });
      }
    }

    function onUp(ev: PointerEvent) {
      if (ev.pointerId !== drag.pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      // Leave `dragRef.current` intact for the click-capture handler below
      // — the click fires right after this on the same gesture and needs
      // to see whether it moved.
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  // Swallow the synthetic click a drag produces, so dragging over a hex
  // never selects it. A genuine click (no movement) passes through to the
  // hex button's own onClick untouched.
  function handleClickCapture(e: ReactMouseEvent<HTMLDivElement>) {
    if (dragRef.current?.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
    dragRef.current = null;
  }

  const dotSize = DOT_GAP * zoom;

  return (
    <Panel
      color="default"
      className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden border-neutral-700 bg-neutral-700 p-0"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, ${DOT_COLOR} ${DOT_RADIUS}px, transparent ${DOT_RADIUS}px)`,
          backgroundSize: `${dotSize}px ${dotSize}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      <div
        ref={viewportRef}
        className="absolute inset-0 touch-none select-none cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onClickCapture={handleClickCapture}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {children}
        </div>
      </div>

      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        <Button
          onClick={() => zoomByButton(ZOOM_BUTTON_STEP)}
          aria-label="Zoom in"
          color="neutral"
          variant="contained"
          className="p-1.5"
        >
          <PlusIcon />
        </Button>
        <Button
          onClick={() => zoomByButton(1 / ZOOM_BUTTON_STEP)}
          aria-label="Zoom out"
          color="neutral"
          variant="contained"
          className="p-1.5"
        >
          <MinusIcon />
        </Button>
        <Button
          onClick={recenter}
          aria-label="Recenter"
          color="neutral"
          variant="contained"
          className="p-1.5"
        >
          <TargetIcon />
        </Button>
      </div>
    </Panel>
  );
}
