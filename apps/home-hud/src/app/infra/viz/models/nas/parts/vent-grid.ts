/**
 * Cell-centered `[a, b]` positions for a `cols` x `rows` dot grid filling a
 * `spanA` x `spanB` rectangle, centered on the origin. `a` runs along the
 * columns axis, `b` along the rows axis.
 */
export function ventGridPositions(
  spanA: number,
  spanB: number,
  cols: number,
  rows: number,
): [number, number][] {
  const stepA = spanA / cols;
  const stepB = spanB / rows;
  const result: [number, number][] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      result.push([
        -spanA / 2 + stepA * (col + 0.5),
        -spanB / 2 + stepB * (row + 0.5),
      ]);
    }
  }
  return result;
}
