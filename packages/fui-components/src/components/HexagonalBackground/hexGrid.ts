/**
 * Hex grid geometry, grid building, and edge graph for HexagonalBackground.
 */

export type Hex = {
  id: string;
  cx: number;
  cy: number;
  row: number;
  col: number;
};

export type Edge = {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  aKey: string;
  bKey: string;
};

export type Vertex = {
  x: number;
  y: number;
  edges: Set<string>;
};

export type EdgeGraph = {
  vertices: Map<string, Vertex>;
  edges: Map<string, Edge>;
};

// ─── Hex geometry ─────────────────────────────────────────────────────────────
const S = 0.3;
export const HEX_W = 100 * S;
export const HEX_H = 115.47 * S;
const ROW_H = HEX_H * 0.75;

export const LOCAL_VERTS: number[][] = [
  [0, -57.735 * S],
  [50 * S, -28.868 * S],
  [50 * S, 28.868 * S],
  [0, 57.735 * S],
  [-50 * S, 28.868 * S],
  [-50 * S, -28.868 * S],
];

export const POINTS_STR = LOCAL_VERTS.map(([x, y]) => `${x},${y}`).join(' ');
export const SIDE_LEN = Math.hypot(
  LOCAL_VERTS[1][0] - LOCAL_VERTS[0][0],
  LOCAL_VERTS[1][1] - LOCAL_VERTS[0][1],
);

/** Single path `d` string for the entire hex grid (one path element instead of N polygons). */
export function buildGridPath(hexes: Hex[]): string {
  return hexes
    .map((hex) => {
      const [v0, ...rest] = LOCAL_VERTS;
      const x0 = hex.cx + v0[0];
      const y0 = hex.cy + v0[1];
      const segments = rest
        .map(([vx, vy]) => `L ${hex.cx + vx},${hex.cy + vy}`)
        .join(' ');
      return `M ${x0},${y0} ${segments} Z`;
    })
    .join(' ');
}

export function buildGrid(width: number, height: number): Hex[] {
  const cols = Math.ceil(width / HEX_W) + 2;
  const rows = Math.ceil(height / ROW_H) + 2;
  const hexes: Hex[] = [];
  for (let row = -1; row < rows; row++) {
    const offset = row % 2 !== 0 ? HEX_W / 2 : 0;
    for (let col = -1; col < cols; col++) {
      const cx = col * HEX_W + offset + HEX_W / 2;
      const cy = row * ROW_H + HEX_H / 2;
      hexes.push({ id: `${row}_${col}`, cx, cy, row, col });
    }
  }
  return hexes;
}

const R2 = (v: number) => `${Math.round(v * 100) / 100}`;
const vKey = ([x, y]: number[]) => `${R2(x)},${R2(y)}`;

export function buildEdgeGraph(hexes: Hex[]): EdgeGraph {
  const vertices = new Map<string, Vertex>();
  const edges = new Map<string, Edge>();

  const ensureVertex = ([x, y]: number[]) => {
    const k = vKey([x, y]);
    if (!vertices.has(k)) vertices.set(k, { x, y, edges: new Set() });
    return k;
  };

  for (const hex of hexes) {
    for (let i = 0; i < 6; i++) {
      const [lx0, ly0] = LOCAL_VERTS[i];
      const [lx1, ly1] = LOCAL_VERTS[(i + 1) % 6];
      const wx0 = hex.cx + lx0,
        wy0 = hex.cy + ly0;
      const wx1 = hex.cx + lx1,
        wy1 = hex.cy + ly1;
      const ka = ensureVertex([wx0, wy0]);
      const kb = ensureVertex([wx1, wy1]);
      const ek = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (!edges.has(ek)) {
        edges.set(ek, {
          ax: wx0,
          ay: wy0,
          bx: wx1,
          by: wy1,
          aKey: ka,
          bKey: kb,
        });
        vertices.get(ka)!.edges.add(ek);
        vertices.get(kb)!.edges.add(ek);
      }
    }
  }
  return { vertices, edges };
}
