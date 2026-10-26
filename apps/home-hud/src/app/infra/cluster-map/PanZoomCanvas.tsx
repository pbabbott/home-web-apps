'use client';

import { Button, HexagonalBackground, Panel } from '@abbottland/fui-components';
import { Icon } from '@abbottland/fui-icons';
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
  // Tracks every currently-down touch pointer's last known position, keyed
  // by pointerId — lets a second finger landing mid single-finger-pan
  // upgrade the gesture to a pinch, using the distance between these two
  // points rather than reconstructing multi-touch from scratch.
  const activeTouchPointersRef = useRef<Map<number, Point>>(new Map());
  const pinchRef = useRef<{ startDistance: number; startZoom: number } | null>(
    null,
  );

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
    const isTouch = e.pointerType === 'touch';

    if (isTouch) {
      activeTouchPointersRef.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
      });
      if (activeTouchPointersRef.current.size >= 2) {
        const [a, b] = [...activeTouchPointersRef.current.values()];
        pinchRef.current = {
          startDistance: Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1),
          startZoom: zoom,
        };
        // The second finger landing cancels any single-finger pan already
        // in progress (from the first finger) — pinch takes over.
        dragRef.current = null;
      }
    } else if (e.button !== 0 && e.button !== 1) {
      // Primary (left) or auxiliary (middle) button starts a pan.
      return;
    }
    // Middle-click normally triggers the browser's autoscroll cursor —
    // prevent that so it reads as a pan instead.
    if (e.button === 1) e.preventDefault();

    const drag: DragState = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panStartX: pan.x,
      panStartY: pan.y,
      moved: false,
    };
    // Only the first finger (or a mouse) drives single-pointer pan — a
    // second finger's `drag` stays local to its own closure below, used
    // only to satisfy the `pointerId` check once pinch tracking ends.
    if (!isTouch || activeTouchPointersRef.current.size === 1) {
      dragRef.current = drag;
    }

    function onMove(ev: PointerEvent) {
      if (isTouch && activeTouchPointersRef.current.has(ev.pointerId)) {
        activeTouchPointersRef.current.set(ev.pointerId, {
          x: ev.clientX,
          y: ev.clientY,
        });
      }

      if (pinchRef.current && activeTouchPointersRef.current.size >= 2) {
        const [a, b] = [...activeTouchPointersRef.current.values()];
        const distance = Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1);
        const rect = viewportRef.current?.getBoundingClientRect();
        const origin = rect
          ? { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top }
          : { x: 0, y: 0 };
        zoomAround(
          pinchRef.current.startZoom *
            (distance / pinchRef.current.startDistance),
          origin,
        );
        return;
      }

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
      if (isTouch) {
        activeTouchPointersRef.current.delete(ev.pointerId);
        if (activeTouchPointersRef.current.size < 2) {
          pinchRef.current = null;
        }
      }
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

  return (
    <Panel
      color="default"
      // Below `lg`, the row (InfraMapClient) switches from flex-row to
      // flex-col, stacking this canvas above the detail panel — whose own
      // content (shrink-0, sized to fit two chart canvases) can demand more
      // height than the row has. Without a floor here, this flex-1
      // min-h-0 item just gets squeezed to 0 to make room, i.e. the whole
      // map disappears. `lg:min-h-0` restores the old behavior once the row
      // is flex-row, where cross-axis `items-stretch` sizing (not this
      // item's own content demand) decides its height.
      className="relative h-full min-h-72 min-w-0 flex-1 overflow-hidden border-neutral-700 bg-neutral-700 p-0 lg:min-h-0"
    >
      <HexagonalBackground className="absolute inset-0" sparksEnabled={false} />

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
          <Icon name="plus" size={16} />
        </Button>
        <Button
          onClick={() => zoomByButton(1 / ZOOM_BUTTON_STEP)}
          aria-label="Zoom out"
          color="neutral"
          variant="contained"
          className="p-1.5"
        >
          <Icon name="minus" size={16} />
        </Button>
        <Button
          onClick={recenter}
          aria-label="Recenter"
          color="neutral"
          variant="contained"
          className="p-1.5"
        >
          <Icon name="target" size={16} />
        </Button>
      </div>
    </Panel>
  );
}
