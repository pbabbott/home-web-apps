import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import Typography from '../Typography/Typography';
import { EdgeSparkEffect } from '../EdgeSparkEffect/EdgeSparkEffect';

export type ComparatorColor = 'primary' | 'error';

export interface ComparatorProps {
  /** Value shown in the left pill. */
  valueA: string;
  /** Value shown in the right pill. */
  valueB: string;
  /** Caption under the left pill. */
  captionA?: string;
  /** Caption under the right pill. */
  captionB?: string;
  /** Status text above the connector, e.g. "Synchronized". */
  label?: string;
  /**
   * Whether the two sides match. Defaults to `valueA === valueB`.
   * When false the connector is broken by a slash.
   */
  inSync?: boolean;
  /** Override the color. Defaults to `primary` when in sync, `error` otherwise. */
  color?: ComparatorColor;
  /**
   * Animate sparks along the connector, one line travelling from each side
   * toward the other and back. Only plays while the sides are in sync.
   */
  active?: boolean;
  className?: string;
}

// Geometry of ConnectorLines: two 1px lines separated by a 9px gap.
const LINE_Y_TOP = 0.5;
const LINE_Y_BOTTOM = 10.5;
const CONNECTOR_HEIGHT = 11;
// One out-and-back lap; EdgeSparkEffect's default (1.3s per pass) is too fast
// over a doubled path.
const SPARK_DURATION_S = 2.4;

const ConnectorSparks: React.FC<{
  color: ComparatorColor;
  width: number;
}> = ({ color, width }) => {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const topId = `comparator-spark-a-${id}`;
  const bottomId = `comparator-spark-b-${id}`;
  // Out and back along the same line, so the loop restarts where it ends
  // instead of the spark jumping from one end to the other.
  const topPath = `M 0 ${LINE_Y_TOP} L ${width} ${LINE_Y_TOP} L 0 ${LINE_Y_TOP}`;
  const bottomPath = `M ${width} ${LINE_Y_BOTTOM} L 0 ${LINE_Y_BOTTOM} L ${width} ${LINE_Y_BOTTOM}`;
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 overflow-visible"
      width={width}
      height={CONNECTOR_HEIGHT}
    >
      <path id={topId} d={topPath} fill="none" stroke="none" />
      <path id={bottomId} d={bottomPath} fill="none" stroke="none" />
      <EdgeSparkEffect
        id={topId}
        edgePath={topPath}
        color={color}
        duration={SPARK_DURATION_S}
      />
      <EdgeSparkEffect
        id={bottomId}
        edgePath={bottomPath}
        color={color}
        duration={SPARK_DURATION_S}
      />
    </svg>
  );
};

const colorClasses: Record<
  ComparatorColor,
  { text: string; border: string; line: string }
> = {
  primary: {
    text: 'text-primary-600',
    border: 'border-primary-600',
    line: 'bg-primary-600',
  },
  error: {
    text: 'text-error-400',
    border: 'border-error-600',
    line: 'bg-error-600',
  },
};

const ConnectorLines: React.FC<{ lineClass: string }> = ({ lineClass }) => (
  <div aria-hidden="true" className="flex flex-1 flex-col gap-[9px]">
    <div className={extendedTwMerge('h-px', lineClass)} />
    <div className={extendedTwMerge('h-px', lineClass)} />
  </div>
);

const BreakSlash: React.FC<{ lineClass: string }> = ({ lineClass }) => (
  <svg
    aria-hidden="true"
    className={extendedTwMerge('h-6 w-6 shrink-0 -my-1', lineClass)}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
    shapeRendering="crispEdges"
  >
    <line x1="4" y1="22" x2="14" y2="2" />
    <line x1="10" y1="22" x2="20" y2="2" />
  </svg>
);

type Colors = (typeof colorClasses)[ComparatorColor];

const Pill: React.FC<{ value: string; colors: Colors }> = ({
  value,
  colors,
}) => (
  <div
    className={extendedTwMerge(
      'flex min-w-24 items-center justify-center rounded-full border-2 px-4 py-2',
      colors.border,
    )}
  >
    <Typography variant="body2" component="span" className={colors.text}>
      {value}
    </Typography>
  </div>
);

const Caption: React.FC<{ children?: string }> = ({ children }) =>
  children ? (
    <Typography variant="small" component="span" className="text-center">
      {children}
    </Typography>
  ) : null;

export const Comparator: React.FC<ComparatorProps> = ({
  valueA,
  valueB,
  captionA,
  captionB,
  label,
  inSync,
  color,
  active = false,
  className,
}) => {
  const synced = inSync ?? valueA === valueB;
  const resolvedColor = color ?? (synced ? 'primary' : 'error');
  const colors = colorClasses[resolvedColor];

  const connectorRef = useRef<HTMLDivElement>(null);
  const [connectorWidth, setConnectorWidth] = useState(0);
  useLayoutEffect(() => {
    const el = connectorRef.current;
    if (!el) return;
    const update = () => setConnectorWidth(el.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={extendedTwMerge(
        'inline-grid grid-cols-[auto_minmax(14rem,1fr)_auto] items-center gap-x-2 gap-y-2',
        className,
      )}
      data-in-sync={synced}
    >
      <Pill value={valueA} colors={colors} />

      <div ref={connectorRef} className="relative flex items-center">
        {label && (
          <Typography
            variant="body2"
            component="span"
            className={extendedTwMerge(
              'absolute bottom-full left-0 right-0 mb-1 text-center',
              colors.text,
            )}
          >
            {label}
          </Typography>
        )}
        <ConnectorLines lineClass={colors.line} />
        {!synced && <BreakSlash lineClass={colors.text} />}
        {!synced && <ConnectorLines lineClass={colors.line} />}
        {active && synced && connectorWidth > 0 && (
          <ConnectorSparks color={resolvedColor} width={connectorWidth} />
        )}
      </div>

      <Pill value={valueB} colors={colors} />

      <div className="flex justify-center">
        <Caption>{captionA}</Caption>
      </div>
      <div />
      <div className="flex justify-center">
        <Caption>{captionB}</Caption>
      </div>
    </div>
  );
};

export default Comparator;
