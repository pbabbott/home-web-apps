import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { primary } from '../../tokens/colors';
import { Typography } from '../Typography/Typography';

export type TabsProps = React.ComponentProps<typeof RadixTabs.Root>;
export type TabsListProps = React.ComponentProps<typeof RadixTabs.List>;
export type TabsTriggerProps = React.ComponentProps<typeof RadixTabs.Trigger>;
export type TabsContentProps = React.ComponentProps<typeof RadixTabs.Content>;

/** No styling needed on the root — same re-export pattern as `DropdownMenuTrigger = RDM.Trigger`. */
export const Tabs = RadixTabs.Root;

/** Corners clipped at a small chamfer — the same cut-corner silhouette the chamfered-box 3D models use, borrowed here as the house's "futuristic panel" signature. */
const CHAMFERED_PANEL =
  '[clip-path:polygon(6px_0,100%_0,100%_calc(100%-6px),calc(100%-6px)_100%,0_100%,0_6px)]';

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(node);
      else (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

interface IndicatorRect {
  left: number;
  width: number;
}

/**
 * Tracks the active trigger's position via a `MutationObserver` on
 * `data-state` (Radix sets this on every trigger, so this works whether
 * the active tab changed through a controlled `value` prop or Radix's own
 * uncontrolled click handling) rather than needing Radix's internal
 * context — keeps this a plain DOM measurement, not a Radix-version-
 * dependent hook.
 *
 * Also keeps a `ResizeObserver` pointed at whichever label is currently
 * active. This matters because the very first measurement can happen
 * before the page's CSS/custom font has fully applied (a brief
 * flash-of-unstyled-content window during initial mount, where text
 * renders in a wider fallback font before the real one swaps in) —
 * `data-state` doesn't change when that settles, so without this the
 * indicator would freeze at that first, too-wide reading forever. The
 * `ResizeObserver` re-fires whenever the label's own box actually resizes,
 * for any reason, and re-measures then.
 */
function useActiveIndicator(
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const [indicator, setIndicator] = useState<IndicatorRect | null>(null);
  const labelResizeObserverRef = useRef<ResizeObserver | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(
      '[data-state="active"]',
    );
    if (!active) {
      setIndicator(null);
      return;
    }
    // Measure the rendered label (the Typography span TabsTrigger wraps its
    // children in), not the trigger button's own padded hit area — the
    // button's `px-3` click target is deliberately wider than the word for
    // a comfortable tap target, but an indicator sized to that padding
    // bleeds toward the next tab (only `gap-x-1` apart) and reads as
    // spanning both tabs instead of marking just the active one.
    const label = (active.firstElementChild as HTMLElement | null) ?? active;
    const containerRect = container.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    setIndicator({
      left: labelRect.left - containerRect.left,
      width: labelRect.width,
    });

    const resizeObserver = labelResizeObserverRef.current;
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver.observe(label);
    }
  }, [containerRef]);

  useLayoutEffect(() => {
    labelResizeObserverRef.current = new ResizeObserver(measure);
    measure();
    const container = containerRef.current;
    const mutationObserver = container ? new MutationObserver(measure) : null;
    if (container && mutationObserver) {
      mutationObserver.observe(container, {
        attributes: true,
        attributeFilter: ['data-state'],
        subtree: true,
      });
    }
    window.addEventListener('resize', measure);
    return () => {
      labelResizeObserverRef.current?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, containerRef]);

  return indicator;
}

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  function TabsList({ className, children, ...props }, forwardedRef) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const indicator = useActiveIndicator(containerRef);

    return (
      <RadixTabs.List
        ref={mergeRefs(forwardedRef, containerRef)}
        className={extendedTwMerge(
          'relative flex gap-x-1 overflow-x-auto border border-neutral-700 bg-neutral-950/40 px-2 py-1',
          CHAMFERED_PANEL,
          className,
        )}
        {...props}
      >
        {children}
        {indicator && (
          <>
            {/* The sliding highlight bar — prominent width/glow, animates via a plain CSS transition on left/width. */}
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0 h-[2px] bg-primary-500 transition-[left,width] duration-300 ease-out"
              style={{
                left: indicator.left,
                width: indicator.width,
                boxShadow: `0 0 8px 2px ${primary[500]}90, 0 0 2px ${primary[500]}`,
              }}
            />
            {/* A small diamond tick floating above the bar — the one ornamental flourish, echoing the circle-on-line accent used elsewhere (NavItem's LineWithCircle). Kept visually separate from the bar rather than touching it. */}
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-[7px] h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-primary-500 transition-[left] duration-300 ease-out"
              style={{
                left: indicator.left + indicator.width / 2,
                boxShadow: `0 0 6px 1px ${primary[500]}90`,
              }}
            />
          </>
        )}
      </RadixTabs.List>
    );
  },
);

export const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  TabsTriggerProps
>(function TabsTrigger({ className, children, ...props }, ref) {
  return (
    <RadixTabs.Trigger
      ref={ref}
      className={extendedTwMerge(
        'relative cursor-pointer px-3 py-2 whitespace-nowrap outline-none transition-colors duration-200',
        'text-neutral-400 hover:text-neutral-300',
        'data-[state=active]:text-primary-500',
        'focus-visible:outline-2 focus-visible:outline-primary-400 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    >
      <Typography variant="button" component="span">
        {children}
      </Typography>
    </RadixTabs.Trigger>
  );
});

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  function TabsContent({ className, ...props }, ref) {
    return (
      <RadixTabs.Content
        ref={ref}
        className={extendedTwMerge('outline-none', className)}
        {...props}
      />
    );
  },
);
