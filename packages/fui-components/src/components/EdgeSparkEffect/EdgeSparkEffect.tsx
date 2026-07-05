'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import {
  primary,
  secondary,
  accentPurple,
  accentFalcon,
  success,
  warning,
  error,
  neutral,
} from '../../tokens/colors';
import type { ButtonColor } from '../buttonColorTokens';

const SPARK_PALETTE: Record<
  ButtonColor,
  { glow: string; core: string; head: string }
> = {
  primary: { glow: primary[700], core: primary[400], head: primary[200] },
  secondary: {
    glow: secondary[700],
    core: secondary[400],
    head: secondary[200],
  },
  success: { glow: success[700], core: success[400], head: success[200] },
  error: { glow: error[700], core: error[400], head: error[200] },
  warning: { glow: warning[700], core: warning[400], head: warning[200] },
  'accent-purple': {
    glow: accentPurple[700],
    core: accentPurple[400],
    head: accentPurple[200],
  },
  'accent-falcon': {
    glow: accentFalcon[700],
    core: accentFalcon[400],
    head: accentFalcon[200],
  },
  neutral: { glow: neutral[700], core: neutral[400], head: neutral[200] },
};

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

/** How long a single one-shot pass takes to travel the full path, in ms. */
export const SPARK_DURATION_MS = SPARK_DURATION * 1000;

const GLOW_OPACITIES = makeRamp(NUM_CHUNKS, 0.02, 0.6);
const CORE_OPACITIES = makeRamp(NUM_CHUNKS, 0.04, 1.0);

// Size ramp: tail→head in px. Increase max values to make spark larger overall.
const GLOW_WIDTHS = makeRamp(NUM_CHUNKS, 3, 4); // outer halo px: tail=3, head=4
const CORE_WIDTHS = makeRamp(NUM_CHUNKS, 1, 1.75); // bright core px: tail=1, head=1.75

const CHUNK_DELAY_STEP =
  (TRAIL_FRACTION / NUM_CHUNKS + CHUNK_SPACING) * SPARK_DURATION;

export interface EdgeSparkEffectProps {
  edgePath: string;
  id: string;
  /** Defaults to 'primary' to match the effect's original look. */
  color?: ButtonColor;
  /** Play once from the start of the path and hold, instead of looping
   * forever. The default (false, ambient/looping) drives the trail via CSS
   * animations and the head dot via SMIL animateMotion — two independent
   * browser animation engines with no shared clock. That's invisible for an
   * ambient effect where nothing needs to line up frame-perfectly, but for a
   * one-shot "dot leading its own trail" effect, any drift between the two
   * engines shows up as the dot visibly detaching from the trail. One-shot
   * mode instead drives both from a single requestAnimationFrame clock. */
  oneShot?: boolean;
}

export function EdgeSparkEffect({
  edgePath,
  id,
  color = 'primary',
  oneShot = false,
}: EdgeSparkEffectProps) {
  const measureRef = useRef<SVGPathElement>(null);
  const headCircleRef = useRef<SVGCircleElement>(null);
  const glowRefs = useRef<(SVGPathElement | null)[]>([]);
  const coreRefs = useRef<(SVGPathElement | null)[]>([]);
  const [pathLen, setPathLen] = useState(300);
  const palette = SPARK_PALETTE[color];

  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const len = measureRef.current.getTotalLength();
    if (len > 0) setPathLen(len);
  }, [edgePath]);

  // One-shot: single rAF clock drives both the head circle's position and
  // every trail chunk's dash-offset every frame, so they cannot drift apart.
  useLayoutEffect(() => {
    if (!oneShot) return;
    const pathEl = measureRef.current;
    if (!pathEl) return;
    const len = pathEl.getTotalLength();
    if (len <= 0) return;

    const totalMs = SPARK_DURATION * 1000;
    // Same tail-to-head stagger as before, expressed as a start delay per
    // chunk: head-side (high i) chunks start first, dim tail (low i) chunks
    // start last and grow the trail in behind the head.
    const chunkDelayMs = GLOW_OPACITIES.map(
      (_, i) => (NUM_CHUNKS - 1 - i) * CHUNK_DELAY_STEP * 1000,
    );

    const setHeadPosition = (progress: number) => {
      if (!headCircleRef.current) return;
      const pt = pathEl.getPointAtLength(progress * len);
      headCircleRef.current.setAttribute('cx', `${pt.x}`);
      headCircleRef.current.setAttribute('cy', `${pt.y}`);
    };

    setHeadPosition(0);

    let rafId: number;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      setHeadPosition(Math.min(1, elapsed / totalMs));

      for (let i = 0; i < NUM_CHUNKS; i++) {
        const chunkElapsed = Math.max(0, elapsed - chunkDelayMs[i]);
        const chunkProgress = Math.min(1, chunkElapsed / totalMs);
        const offset = `${-(chunkProgress * len)}`;
        const glowEl = glowRefs.current[i];
        const coreEl = coreRefs.current[i];
        if (glowEl) glowEl.style.strokeDashoffset = offset;
        if (coreEl) coreEl.style.strokeDashoffset = offset;
      }

      if (elapsed < totalMs) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [oneShot, edgePath]);

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

      {!oneShot && (
        <style>{`
          @keyframes ${animName} {
            from { stroke-dashoffset: 0; }
            to   { stroke-dashoffset: ${-pathLen}; }
          }
        `}</style>
      )}

      {GLOW_OPACITIES.map((glowOp, i) => {
        // Looping only: negative delay seeks each chunk into an
        // already-running cycle, so the trail is pre-formed the instant it
        // mounts. One-shot chunks are driven imperatively by the rAF loop
        // above instead (no CSS animation at all).
        const delay = `${-(i * CHUNK_DELAY_STEP).toFixed(4)}s`;
        const anim = `${animName} ${SPARK_DURATION}s linear ${delay} infinite`;
        return (
          <g key={i}>
            <path
              ref={
                oneShot
                  ? (el) => {
                      glowRefs.current[i] = el;
                    }
                  : undefined
              }
              d={edgePath}
              fill="none"
              stroke={palette.glow}
              strokeWidth={GLOW_WIDTHS[i]}
              opacity={glowOp}
              strokeLinecap="round"
              strokeDasharray={`${chunkPx} ${gapPx}`}
              style={oneShot ? undefined : { animation: anim }}
            />
            <path
              ref={
                oneShot
                  ? (el) => {
                      coreRefs.current[i] = el;
                    }
                  : undefined
              }
              d={edgePath}
              fill="none"
              stroke={palette.core}
              strokeWidth={CORE_WIDTHS[i]}
              opacity={CORE_OPACITIES[i]}
              strokeLinecap="round"
              strokeDasharray={`${chunkPx} ${gapPx}`}
              style={oneShot ? undefined : { animation: anim }}
            />
          </g>
        );
      })}

      {/* Head circle radius matches head chunk's core width */}
      <circle
        ref={oneShot ? headCircleRef : undefined}
        r={CORE_WIDTHS[NUM_CHUNKS - 1] * 1.2}
        fill={palette.head}
        filter={`url(#${glowId})`}
      >
        {!oneShot && (
          <animateMotion
            dur={`${SPARK_DURATION}s`}
            repeatCount="indefinite"
            begin={headBegin}
          >
            <mpath href={`#${id}`} />
          </animateMotion>
        )}
      </circle>
    </>
  );
}
