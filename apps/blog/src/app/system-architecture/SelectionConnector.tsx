'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import anime from 'animejs';
import {
  EdgeSparkEffect,
  SPARK_DURATION_MS,
  primary,
  secondary,
  success,
  error,
  warning,
  accentPurple,
  accentFalcon,
  neutral,
  type ButtonColor,
} from '@abbottland/fui-components';

interface ConnectorPalette {
  /** Tailwind text-color class for the connector line and spark trail. */
  textClass: string;
  /** Same color as a raw CSS value (from fui-components' color tokens), for
   * consumers that need an actual color rather than a Tailwind class — e.g.
   * the diagram reveal's edge line. */
  hex: string;
  /** Same color again, as a border-color Tailwind class — for the diagram's
   * own persistent border, which should keep matching the selected color
   * even after the reveal finishes (unlike the transient edge line above). */
  borderClass: string;
}

// One entry per button color, each field spelled out as a literal class
// string — Tailwind's scanner only matches literal text in source, so a
// template-built `text-${color}-400` would never be picked up. Kept as a
// single object (rather than parallel maps) so adding a new ButtonColor only
// means touching one place.
const CONNECTOR_PALETTE: Record<ButtonColor, ConnectorPalette> = {
  primary: {
    textClass: 'text-primary-400',
    hex: primary[400],
    borderClass: 'border-primary-400',
  },
  secondary: {
    textClass: 'text-secondary-400',
    hex: secondary[400],
    borderClass: 'border-secondary-400',
  },
  success: {
    textClass: 'text-success-400',
    hex: success[400],
    borderClass: 'border-success-400',
  },
  error: {
    textClass: 'text-error-400',
    hex: error[400],
    borderClass: 'border-error-400',
  },
  warning: {
    textClass: 'text-warning-400',
    hex: warning[400],
    borderClass: 'border-warning-400',
  },
  'accent-purple': {
    textClass: 'text-accent-purple-300',
    hex: accentPurple[300],
    borderClass: 'border-accent-purple-300',
  },
  'accent-falcon': {
    textClass: 'text-accent-falcon-400',
    hex: accentFalcon[400],
    borderClass: 'border-accent-falcon-400',
  },
  neutral: {
    textClass: 'text-neutral-300',
    hex: neutral[300],
    borderClass: 'border-neutral-300',
  },
};

export function getConnectorPalette(color: ButtonColor): ConnectorPalette {
  return CONNECTOR_PALETTE[color];
}

// How far the line drops straight down from the button before turning left,
// in px. Tune this to taste.
const DROP_BEFORE_TURN = 4;
const DRAW_DURATION = 650;
// Keep the spark mounted a beat past its own travel time, so it never gets
// unmounted mid-frame — tied to SPARK_DURATION_MS rather than a standalone
// magic number so the two can't silently drift apart.
const SPARK_CLEANUP_BUFFER_MS = 200;
const SPARK_LIFETIME_MS = SPARK_DURATION_MS + SPARK_CLEANUP_BUFFER_MS;
// Fire onArrive slightly before the spark visually finishes — feels
// smoother than waiting for the exact last frame.
const ARRIVE_EARLY_MS = 100;

// Left padding applied to the section the line enters (see ServiceComponents).
export const DIAGRAM_LEFT_PADDING = 16;

interface ConnectorPoints {
  bx: number;
  by: number;
  turnY: number;
  containerLeftX: number;
  midY: number;
  diagramLeftX: number;
}

function buildPath({
  bx,
  by,
  turnY,
  containerLeftX,
  midY,
  diagramLeftX,
}: ConnectorPoints): string {
  return [
    `M ${bx} ${by}`,
    `L ${bx} ${turnY}`,
    `L ${containerLeftX} ${turnY}`,
    `L ${containerLeftX} ${midY}`,
    `L ${diagramLeftX} ${midY}`,
  ].join(' ');
}

function measure(
  containerEl: HTMLElement,
  buttonEl: HTMLElement,
  entryEl: HTMLElement,
): ConnectorPoints {
  const containerRect = containerEl.getBoundingClientRect();
  const buttonRect = buttonEl.getBoundingClientRect();
  const entryRect = entryEl.getBoundingClientRect();

  const bx = buttonRect.left + buttonRect.width / 2 - containerRect.left;
  const by = buttonRect.bottom - containerRect.top;
  const containerLeftX = 0;
  // Same left padding the diagram's wrapper uses (see ServiceComponents),
  // so this lines up exactly with the diagram's own left edge/border.
  const diagramLeftX = DIAGRAM_LEFT_PADDING;
  const entryVerticalCenter =
    entryRect.top + entryRect.height / 2 - containerRect.top;
  const turnY = Math.min(
    by + DROP_BEFORE_TURN,
    Math.max(by + 1, entryVerticalCenter - 1),
  );
  const midY = Math.max(turnY + 1, entryVerticalCenter);

  return { bx, by, turnY, containerLeftX, midY, diagramLeftX };
}

export interface SelectionConnectorProps {
  /** Positioned (relative) ancestor the SVG overlay is measured against. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Every selectable button, keyed by id. Populate via each button's ref callback. */
  buttonRefs: React.RefObject<Map<string, HTMLElement>>;
  /** Top of the section the line should travel into. */
  entryRef: React.RefObject<HTMLElement | null>;
  selectedId: string;
  /** Color of the currently-selected button; the line matches it. */
  color: ButtonColor;
  /** Called once the spark reaches the diagram, on a selection change (not
   * on first mount). Cue to swap the diagram content and play its reveal. */
  onArrive?: () => void;
}

export function SelectionConnector({
  containerRef,
  buttonRefs,
  entryRef,
  selectedId,
  color,
  onArrive,
}: SelectionConnectorProps) {
  const rawId = useId().replace(/:/g, '');
  const connectorId = `selection-connector-${rawId}`;

  const pathRef = useRef<SVGPathElement>(null);
  const currentRef = useRef<ConnectorPoints | null>(null);
  const isFirstRef = useRef(true);
  const arriveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sparkPath, setSparkPath] = useState<string | null>(null);
  const [sparkKey, setSparkKey] = useState(0);

  // containerRef targets an ancestor element. React attaches host refs
  // bottom-up during commit, so an ancestor's ref is not yet populated
  // while this component's own layout effects are running on first mount.
  // Poll for one frame until it resolves, then treat that as "ready".
  const [containerEl, setContainerEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (containerRef.current) {
      setContainerEl(containerRef.current);
      return;
    }
    let rafId: number;
    const check = () => {
      if (containerRef.current) setContainerEl(containerRef.current);
      else rafId = requestAnimationFrame(check);
    };
    rafId = requestAnimationFrame(check);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerSpark = (d: string) => {
    setSparkPath(d);
    setSparkKey((k) => k + 1);
  };

  // Auto-clear the spark after one pass so it reads as a momentary accent,
  // not a permanent looping effect.
  useLayoutEffect(() => {
    if (!sparkPath) return;
    const timeout = setTimeout(() => setSparkPath(null), SPARK_LIFETIME_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sparkKey]);

  useLayoutEffect(() => {
    const buttonEl = buttonRefs.current?.get(selectedId);
    const entryEl = entryRef.current;
    const pathEl = pathRef.current;
    if (!containerEl || !buttonEl || !entryEl || !pathEl) return;

    const target = measure(containerEl, buttonEl, entryEl);

    if (isFirstRef.current) {
      isFirstRef.current = false;
      currentRef.current = target;
      pathEl.setAttribute('d', buildPath(target));

      const length = pathEl.getTotalLength();
      pathEl.style.strokeDasharray = `${length}`;
      pathEl.style.strokeDashoffset = `${length}`;

      anime({
        targets: pathEl,
        strokeDashoffset: [length, 0],
        duration: DRAW_DURATION,
        easing: 'easeInOutQuad',
        complete: () => {
          // Dash trick was only needed for the reveal — drop it so a longer
          // path picked up by a later selection never gets clipped by a
          // dasharray sized for the first one.
          pathEl.style.strokeDasharray = '';
          pathEl.style.strokeDashoffset = '';
          triggerSpark(buildPath(target));
        },
      });
      return;
    }

    // Selection changes snap immediately — no morph. The connector should
    // feel instantly tied to the clicked button, not travel across the row.
    currentRef.current = target;
    pathEl.setAttribute('d', buildPath(target));
    triggerSpark(buildPath(target));

    if (arriveTimeoutRef.current) clearTimeout(arriveTimeoutRef.current);
    arriveTimeoutRef.current = setTimeout(() => {
      onArrive?.();
    }, SPARK_DURATION_MS - ARRIVE_EARLY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerEl, selectedId]);

  useLayoutEffect(() => {
    return () => {
      if (arriveTimeoutRef.current) clearTimeout(arriveTimeoutRef.current);
    };
  }, []);

  // Layout can reflow independently of selection (button wrap at a new
  // breakpoint, window resize). Snap to the new geometry the same way.
  const selectedIdRef = useRef(selectedId);
  useLayoutEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useLayoutEffect(() => {
    if (!containerEl) return;

    let lastWidth = -1;
    let lastHeight = -1;

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;

      const buttonEl = buttonRefs.current?.get(selectedIdRef.current);
      const entryEl = entryRef.current;
      const pathEl = pathRef.current;
      if (!buttonEl || !entryEl || !pathEl) return;

      const target = measure(containerEl, buttonEl, entryEl);
      currentRef.current = target;
      pathEl.setAttribute('d', buildPath(target));
    });

    ro.observe(containerEl);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerEl]);

  return (
    <svg
      className={`absolute inset-0 w-full h-full overflow-visible pointer-events-none ${getConnectorPalette(color).textClass}`}
      aria-hidden="true"
    >
      <path
        ref={pathRef}
        id={connectorId}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {sparkPath && (
        <EdgeSparkEffect
          key={sparkKey}
          edgePath={sparkPath}
          id={connectorId}
          color={color}
          oneShot
        />
      )}
    </svg>
  );
}
