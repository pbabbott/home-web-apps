'use client';

import React, {
  useCallback,
  useId,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import type { ButtonColor } from '../buttonColorTokens';
import { EdgeSparkEffect } from '../EdgeSparkEffect/EdgeSparkEffect';
import { MaskReveal } from '../MaskReveal/MaskReveal';
import { NavBar } from '../NavBar/NavBar';
import { NavItem } from '../NavItem/NavItem';
import { buildConnectorPath, type ConnectorPoints } from './connectorPath';

export interface ConnectedNavItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  /** Subnav entries shown while this item is selected. */
  children?: ConnectedNavItem[];
}

export interface ConnectedNavProps {
  items: ConnectedNavItem[];
  /** Selected top-level id (controlled). */
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Selected subnav id (controlled). */
  subValue?: string;
  defaultSubValue?: string;
  onSubValueChange?: (id: string) => void;
  /** Color of the spark chasing the connector. */
  color?: ButtonColor;
  /** Run the spark on selection changes. Defaults to true. */
  spark?: boolean;
  /** Seconds for the spark to travel the connector. Defaults to 0.7. */
  sparkDuration?: number;
  className?: string;
}

const GUTTER_X = 2;
const SPARK_CLEANUP_BUFFER_MS = 200;
// Negative top margin pulls the subnav up under the top bar; the connector's
// horizontal run sits just below that bar (TURN_OFFSET) so the first bend
// happens early.
const SUBNAV_INDENT_CLASS = 'ml-8 -mt-1';
const TURN_OFFSET = 10;
// Start the subnav wipe slightly before the spark finishes; it reads smoother
// than waiting for the exact last frame.
const ARRIVE_EARLY_MS = 100;
const REVEAL_DURATION_MS = 500;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ConnectedNav({
  items,
  value,
  defaultValue,
  onValueChange,
  subValue,
  defaultSubValue,
  onSubValueChange,
  color = 'primary',
  spark = true,
  sparkDuration = 0.7,
  className,
}: ConnectedNavProps) {
  const connectorId = `connected-nav-${useId().replace(/:/g, '')}`;

  const [innerValue, setInnerValue] = useState(
    defaultValue ?? items[0]?.id ?? '',
  );
  const selectedId = value ?? innerValue;
  const selected = items.find((i) => i.id === selectedId);
  const subItems = selected?.children ?? [];

  const [innerSub, setInnerSub] = useState(defaultSubValue);
  const selectedSubId = subValue ?? innerSub ?? subItems[0]?.id;

  const containerRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const subItemRefs = useRef(new Map<string, HTMLElement>());

  const [path, setPath] = useState<{ d: string; joint: [number, number] }>();
  const [sparkPath, setSparkPath] = useState<string | null>(null);
  const [sparkKey, setSparkKey] = useState(0);
  const isFirstRef = useRef(true);
  // Subnav wipe: after a spark-driven selection change the subnav stays
  // clipped until the spark arrives, then wipes in left to right.
  const [wipe, setWipe] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const setItemRef = useCallback(
    (map: Map<string, HTMLElement>, id: string) => (el: HTMLElement | null) => {
      if (el) map.set(id, el);
      else map.delete(id);
    },
    [],
  );

  const measure = useCallback((): ConnectorPoints | null => {
    const container = containerRef.current;
    const top = topRef.current;
    const sub = subRef.current;
    const itemEl = itemRefs.current.get(selectedId);
    const firstSubEl = subItems[0]
      ? subItemRefs.current.get(subItems[0].id)
      : undefined;
    if (!container || !top || !sub || !itemEl || !firstSubEl) return null;

    const c = container.getBoundingClientRect();
    const topRect = top.getBoundingClientRect();
    const subRect = sub.getBoundingClientRect();
    const itemStub = itemEl.querySelector('svg')?.getBoundingClientRect();
    const subStub = firstSubEl.querySelector('svg')?.getBoundingClientRect();
    if (!itemStub || !subStub) return null;

    const itemRect = itemEl.getBoundingClientRect();
    const sx = itemRect.left - c.left + 0.5;
    const subX = firstSubEl.getBoundingClientRect().left - c.left + 0.5;
    const midY = Math.min(
      topRect.bottom - c.top + TURN_OFFSET,
      subRect.top - c.top - 2,
    );
    return {
      sx,
      sy: itemStub.bottom - c.top,
      midY,
      gutterX: Math.min(GUTTER_X, sx),
      subY: subStub.bottom - c.top,
      subX,
    };
  }, [selectedId, subItems]);

  const update = useCallback(() => {
    const pts = measure();
    if (!pts) {
      setPath(undefined);
      return null;
    }
    const d = buildConnectorPath(pts);
    setPath({ d, joint: [pts.gutterX, pts.subY] });
    return d;
  }, [measure]);

  useLayoutEffect(() => {
    const d = update();
    if (isFirstRef.current) {
      isFirstRef.current = false;
      return;
    }
    if (d && spark && !prefersReducedMotion()) {
      setSparkPath(d);
      setSparkKey((k) => k + 1);
      setWipe(true);
      setRevealed(false);
    }
    // Re-run only when the selected top item changes.
  }, [selectedId]);

  useLayoutEffect(() => {
    if (!sparkPath) return;
    const t = setTimeout(
      () => setSparkPath(null),
      sparkDuration * 1000 + SPARK_CLEANUP_BUFFER_MS,
    );
    return () => clearTimeout(t);
  }, [sparkKey]);

  useEffect(() => {
    if (!wipe) return;
    const t = setTimeout(
      () => setRevealed(true),
      Math.max(0, sparkDuration * 1000 - ARRIVE_EARLY_MS),
    );
    return () => clearTimeout(t);
    // Restart only for a new spark pass.
  }, [sparkKey]);

  // Reflow (wrapping, window resize, font load) moves the stubs. A font swap
  // changes item widths without changing the container's size, so observe the
  // items themselves too and re-measure once fonts settle.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) update();
    });
    if (typeof ResizeObserver === 'undefined') {
      return () => {
        cancelled = true;
      };
    }
    const ro = new ResizeObserver(() => {
      update();
    });
    ro.observe(el);
    itemRefs.current.forEach((item) => ro.observe(item));
    subItemRefs.current.forEach((item) => ro.observe(item));
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [update]);

  const select = (id: string) => {
    if (value === undefined) setInnerValue(id);
    setInnerSub(undefined);
    onValueChange?.(id);
  };
  const selectSub = (id: string) => {
    if (subValue === undefined) setInnerSub(id);
    onSubValueChange?.(id);
  };

  return (
    <div
      ref={containerRef}
      className={extendedTwMerge('relative flex flex-col', className)}
    >
      <div ref={topRef}>
        <NavBar>
          {items.map((item) => (
            <div key={item.id} ref={setItemRef(itemRefs.current, item.id)}>
              <NavItem
                as="button"
                type="button"
                icon={item.icon}
                active={item.id === selectedId}
                aria-current={item.id === selectedId ? 'page' : undefined}
                showRightLine={false}
                onClick={() => select(item.id)}
              >
                {item.label}
              </NavItem>
            </div>
          ))}
        </NavBar>
      </div>

      {subItems.length > 0 && (
        <div ref={subRef} className={SUBNAV_INDENT_CLASS}>
          <MaskReveal
            key={sparkKey}
            animated={wipe}
            reveal={revealed}
            duration={REVEAL_DURATION_MS}
            delay={0}
          >
            <NavBar>
              {subItems.map((item, i) => (
                <div
                  key={item.id}
                  ref={setItemRef(subItemRefs.current, item.id)}
                >
                  <NavItem
                    as="button"
                    type="button"
                    icon={item.icon}
                    active={item.id === selectedSubId}
                    aria-current={
                      item.id === selectedSubId ? 'page' : undefined
                    }
                    showRightLine={i === subItems.length - 1}
                    onClick={() => selectSub(item.id)}
                  >
                    {item.label}
                  </NavItem>
                </div>
              ))}
            </NavBar>
          </MaskReveal>
        </div>
      )}

      {path && subItems.length > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-neutral-300"
          aria-hidden="true"
        >
          <path
            id={connectorId}
            d={path.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {/* Ringed dot at the elbow where the line enters the subnav. */}
          <circle
            cx={path.joint[0]}
            cy={path.joint[1]}
            r={4}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
          />
          <circle
            cx={path.joint[0]}
            cy={path.joint[1]}
            r={2}
            fill="currentColor"
          />
          {sparkPath && (
            <EdgeSparkEffect
              key={sparkKey}
              edgePath={sparkPath}
              id={connectorId}
              color={color}
              oneShot
              duration={sparkDuration}
            />
          )}
        </svg>
      )}
    </div>
  );
}
