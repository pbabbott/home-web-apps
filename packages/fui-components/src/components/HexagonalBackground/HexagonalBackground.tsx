import { useState, useEffect, useRef } from 'react';
import { buildGrid, buildEdgeGraph, buildGridPath } from './hexGrid';
import { themes, type HexagonalBackgroundTheme } from './hexagonalConstants';
import { useSparkCanvas } from './useSparkEffect';

export type HexagonalBackgroundProps = {
  className?: string;
  style?: React.CSSProperties;
  sparksEnabled?: boolean;
  /** Freezes sparks in place — unlike `sparksEnabled={false}`, existing sparks stay visible, just motionless. */
  sparksFrozen?: boolean;
  theme?: HexagonalBackgroundTheme;
};

export function HexagonalBackground({
  className,
  style,
  sparksEnabled = true,
  sparksFrozen = false,
  theme = 'default',
}: HexagonalBackgroundProps) {
  const colors = themes[theme];
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [hexes, setHexes] = useState<ReturnType<typeof buildGrid>>([]);
  const graphRef = useRef<ReturnType<typeof buildEdgeGraph>>({
    vertices: new Map(),
    edges: new Map(),
  });

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useSparkCanvas(
    canvasRef,
    graphRef,
    hexes,
    size,
    sparksEnabled && !prefersReducedMotion,
    sparksFrozen,
    theme,
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setSize({ width: el.offsetWidth, height: el.offsetHeight });
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const DEBOUNCE_MS = 80;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (timeoutId !== null) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        timeoutId = null;
        setSize({ width, height });
      }, DEBOUNCE_MS);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const grid = buildGrid(size.width, size.height);
    setHexes(grid);
    graphRef.current = buildEdgeGraph(grid);
  }, [size]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: colors.bg,
        ...style,
      }}
    >
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
      >
        <path
          d={buildGridPath(hexes)}
          fill={colors.hexFill}
          stroke={colors.hexStroke}
          strokeWidth={0.5}
        />
      </svg>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
