'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { primary } from '../../tokens/colors';

// Power curve ramp: t=0 is tail, t=1 is head. Higher power = steeper falloff = more electric.
function makeRamp(
  count: number,
  min: number,
  max: number,
  power = 2.5,
): number[] {
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 1 : i / (count - 1);
    return +(min + (max - min) * Math.pow(t, power)).toFixed(4);
  });
}

const NUM_CHUNKS = 32;
const TRAIL_FRACTION = 0.4; // fraction of path occupied by each chunk's dash
const CHUNK_SPACING = 0.005; // gap between consecutive chunks as fraction of path ← tweak for spacing
const SPARK_DURATION = 1.3; // seconds

const GLOW_OPACITIES = makeRamp(NUM_CHUNKS, 0.02, 0.6);
const CORE_OPACITIES = makeRamp(NUM_CHUNKS, 0.04, 1.0);

// Size ramp: tail→head in px. Increase max values to make spark larger overall.
const GLOW_WIDTHS = makeRamp(NUM_CHUNKS, 3, 4); // outer halo px: tail=3, head=4
const CORE_WIDTHS = makeRamp(NUM_CHUNKS, 1, 1.75); // bright core px: tail=1, head=1.75

const CHUNK_DELAY_STEP =
  (TRAIL_FRACTION / NUM_CHUNKS + CHUNK_SPACING) * SPARK_DURATION;

interface EdgeSparkEffectProps {
  edgePath: string;
  id: string;
}

export function EdgeSparkEffect({ edgePath, id }: EdgeSparkEffectProps) {
  const measureRef = useRef<SVGPathElement>(null);
  const [pathLen, setPathLen] = useState(300);

  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const len = measureRef.current.getTotalLength();
    if (len > 0) setPathLen(len);
  }, [edgePath]);

  const chunkPx = (pathLen * TRAIL_FRACTION) / NUM_CHUNKS;
  const gapPx = pathLen - chunkPx;
  const animName = `spark-trail-${id}`;
  const glowId = `spark-head-glow-${id}`;
  const headBegin = `${-((TRAIL_FRACTION + (NUM_CHUNKS - 1) * CHUNK_SPACING) * SPARK_DURATION).toFixed(3)}s`;

  return (
    <>
      <path ref={measureRef} d={edgePath} fill="none" stroke="none" />

      <defs>
        <filter id={glowId} x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <style>{`
        @keyframes ${animName} {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: ${-pathLen}; }
        }
      `}</style>

      {GLOW_OPACITIES.map((glowOp, i) => {
        const delay = `${-(i * CHUNK_DELAY_STEP).toFixed(4)}s`;
        const anim = `${animName} ${SPARK_DURATION}s linear ${delay} infinite`;
        return (
          <g key={i}>
            <path
              d={edgePath}
              fill="none"
              stroke={primary[700]}
              strokeWidth={GLOW_WIDTHS[i]}
              opacity={glowOp}
              strokeLinecap="round"
              strokeDasharray={`${chunkPx} ${gapPx}`}
              style={{ animation: anim }}
            />
            <path
              d={edgePath}
              fill="none"
              stroke={primary[400]}
              strokeWidth={CORE_WIDTHS[i]}
              opacity={CORE_OPACITIES[i]}
              strokeLinecap="round"
              strokeDasharray={`${chunkPx} ${gapPx}`}
              style={{ animation: anim }}
            />
          </g>
        );
      })}

      {/* Head circle radius matches head chunk's core width */}
      <circle
        r={CORE_WIDTHS[NUM_CHUNKS - 1] * 1.2}
        fill={primary[200]}
        filter={`url(#${glowId})`}
      >
        <animateMotion
          dur={`${SPARK_DURATION}s`}
          repeatCount="indefinite"
          begin={headBegin}
        >
          <mpath href={`#${id}`} />
        </animateMotion>
      </circle>
    </>
  );
}
