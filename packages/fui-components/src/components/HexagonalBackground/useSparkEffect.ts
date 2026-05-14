/**
 * Spark effect: particles traveling along hex edges with trails.
 * Draws directly to a canvas in requestAnimationFrame (no React state).
 */

import { useEffect, useRef } from 'react';
import {
  SIDE_LEN,
  type Edge,
  type EdgeGraph,
  type Hex,
  type Vertex,
} from './hexGrid';
import { C } from './hexagonalConstants';

const SPARK_SPEED = 0.24; // px/ms (faster sparks)
const TRAIL_LEN = 80; // number of trail points (longer = longer drawn line)

const NUM_CHUNKS = 4;
const CHUNK_OPACITIES = [0.15, 0.4, 0.7, 1]; // tail → head

let sparkIdCounter = 0;

function createSpark(edges: Map<string, Edge>): {
  id: string;
  edgeKey: string;
  fromKey: string;
  t: number;
  trail: { x: number; y: number; seg: number }[];
  seg: number;
  remainingHops: number;
  dead: boolean;
} {
  const edgeKeys = Array.from(edges.keys());
  const ek = edgeKeys[Math.floor(Math.random() * edgeKeys.length)];
  const edge = edges.get(ek)!;
  const fromKey = Math.random() < 0.5 ? edge.aKey : edge.bKey;
  return {
    id: `spark-${++sparkIdCounter}-${performance.now()}`,
    edgeKey: ek,
    fromKey,
    t: 0,
    trail: [],
    seg: 0,
    remainingHops: 24 + Math.floor(Math.random() * 40), // 24–63 hops for much longer sparks
    dead: false,
  };
}

function advanceSpark(
  spark: {
    id: string;
    edgeKey: string;
    fromKey: string;
    t: number;
    trail: { x: number; y: number; seg: number }[];
    seg: number;
    remainingHops: number;
    dead: boolean;
  },
  edges: Map<string, Edge>,
  vertices: Map<string, Vertex>,
  dt: number,
): void {
  if (spark.dead) return;
  let remaining = SPARK_SPEED * dt;

  for (let guard = 0; guard < 6 && remaining > 0 && !spark.dead; guard++) {
    const edge = edges.get(spark.edgeKey);
    if (!edge) {
      spark.dead = true;
      return;
    }

    const toKey = edge.aKey === spark.fromKey ? edge.bKey : edge.aKey;
    const toVert = vertices.get(toKey)!;
    const fromVert = vertices.get(spark.fromKey)!;
    const dx =
      edge.aKey === spark.fromKey ? edge.bx - edge.ax : edge.ax - edge.bx;
    const dy =
      edge.aKey === spark.fromKey ? edge.by - edge.ay : edge.ay - edge.by;

    const tAdvance = remaining / SIDE_LEN;
    const newT = spark.t + tAdvance;

    spark.trail.push({
      x: fromVert.x + dx * spark.t,
      y: fromVert.y + dy * spark.t,
      seg: spark.seg,
    });
    if (spark.trail.length > TRAIL_LEN) spark.trail.shift();

    if (newT < 1) {
      spark.t = newT;
      remaining = 0;
    } else {
      spark.trail.push({ x: toVert.x, y: toVert.y, seg: spark.seg });
      if (spark.trail.length > TRAIL_LEN) spark.trail.shift();

      spark.remainingHops--;
      if (spark.remainingHops <= 0) {
        spark.dead = true;
        return;
      }

      const candidates = Array.from(toVert.edges).filter(
        (k) => k !== spark.edgeKey,
      );
      if (!candidates.length) {
        spark.dead = true;
        return;
      }

      remaining -= (1 - spark.t) * SIDE_LEN;
      spark.edgeKey = candidates[Math.floor(Math.random() * candidates.length)];
      spark.fromKey = toKey;
      spark.t = 0;
    }
  }
}

function toHex(alpha01: number): string {
  return Math.round(alpha01 * 255)
    .toString(16)
    .padStart(2, '0');
}

function drawSpark(
  ctx: CanvasRenderingContext2D,
  spark: {
    trail: { x: number; y: number; seg: number }[];
    remainingHops: number;
  },
): void {
  const { trail, remainingHops } = spark;
  if (trail.length < 2) return;

  const latestSeg = trail[trail.length - 1].seg;
  const seg = trail.filter((p) => p.seg === latestSeg);
  if (seg.length < 2) return;

  const trailFade = Math.min(1, seg.length / 6);
  const endOfLifeFade =
    remainingHops >= 8 ? 1 : remainingHops <= 0 ? 0 : (remainingHops - 1) / 5;
  const baseAlpha = trailFade * endOfLifeFade;
  const head = seg[seg.length - 1];

  for (let c = 0; c < NUM_CHUNKS; c++) {
    const start = Math.floor((c * seg.length) / NUM_CHUNKS);
    const end =
      c < NUM_CHUNKS - 1
        ? Math.floor(((c + 1) * seg.length) / NUM_CHUNKS) + 1
        : seg.length;
    const slice = seg.slice(start, end);
    if (slice.length < 2) continue;

    const opacity = CHUNK_OPACITIES[c];
    const a = baseAlpha * opacity;

    ctx.beginPath();
    ctx.moveTo(slice[0].x, slice[0].y);
    for (let i = 1; i < slice.length; i++) {
      ctx.lineTo(slice[i].x, slice[i].y);
    }
    ctx.strokeStyle = `${C.sparkGlow}${toHex(a * 0.3)}`;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(slice[0].x, slice[0].y);
    for (let i = 1; i < slice.length; i++) {
      ctx.lineTo(slice[i].x, slice[i].y);
    }
    ctx.strokeStyle = `${C.sparkCore}${toHex(a * 0.85)}`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(head.x, head.y, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = `${C.sparkHead}${toHex(baseAlpha)}`;
  ctx.fill();
}

export function useSparkCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  graphRef: React.RefObject<EdgeGraph>,
  hexes: Hex[],
  size: { width: number; height: number },
): void {
  const sparksRef = useRef<ReturnType<typeof createSpark>[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hexes.length || size.width <= 0 || size.height <= 0) return;

    const { edges, vertices } = graphRef.current ?? {
      vertices: new Map(),
      edges: new Map(),
    };
    if (!edges.size) return;

    sparksRef.current = [];
    canvas.width = size.width;
    canvas.height = size.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();
    let nextSpawnIn = 600 + Math.random() * 1000;
    let rafId: number;

    const loop = (now: number) => {
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;

      nextSpawnIn -= dt;
      if (nextSpawnIn <= 0) {
        sparksRef.current.push(createSpark(edges));
        nextSpawnIn = 700 + Math.random() * 1200;
      }

      for (const spark of sparksRef.current) {
        advanceSpark(spark, edges, vertices, dt);
      }
      sparksRef.current = sparksRef.current.filter((s) => !s.dead);

      ctx.clearRect(0, 0, size.width, size.height);
      for (const spark of sparksRef.current) {
        drawSpark(ctx, spark);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [hexes, graphRef, canvasRef, size.width, size.height]);
}
