export interface ConnectorPoints {
  /** x of the selected top-level item's stub. */
  sx: number;
  /** y where the line starts (bottom of that stub). */
  sy: number;
  /** y of the horizontal run, in the gap between the two bars. */
  midY: number;
  /** x of the vertical run down the left margin. */
  gutterX: number;
  /** y of the subnav entry row. */
  subY: number;
  /** x where the line ends, at the subnav's first stub. */
  subX: number;
}

/**
 * Orthogonal path from the selected top item down, left to the gutter, down to
 * the subnav row and right into the subnav. When the selected item already
 * sits at the gutter the horizontal run collapses and it is a single drop.
 */
export function buildConnectorPath({
  sx,
  sy,
  midY,
  gutterX,
  subY,
  subX,
}: ConnectorPoints): string {
  if (Math.abs(sx - gutterX) < 1) {
    return `M ${sx} ${sy} L ${sx} ${subY} L ${subX} ${subY}`;
  }
  return [
    `M ${sx} ${sy}`,
    `L ${sx} ${midY}`,
    `L ${gutterX} ${midY}`,
    `L ${gutterX} ${subY}`,
    `L ${subX} ${subY}`,
  ].join(' ');
}
