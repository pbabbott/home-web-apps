import React from 'react';
import { HexagonButton } from '../HexagonButton/HexagonButton';

const TILE_SIZE = 100;
/** HexagonButton hex dimensions (from R=45, angle -30°): flat-top so width < height */
const HEX_WIDTH = 78;
const HEX_HEIGHT = 90;

export type TiledHexagonTile = {
  /** Main label (alias: use `text` for backward compatibility) */
  label?: string;
  /** @deprecated Use `label` instead */
  text?: string;
  lowerLabel?: string;
  active?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export type TiledHexagonsProps = {
  tiles?: TiledHexagonTile[];
  tileGap?: number;
  maxHorizontal?: number;
  /** false = suppress shimmer/travel-ring spark effects on active tiles (e.g. reduced-motion mode) */
  animated?: boolean;
};

function getRanges(
  columnCount: number,
  maxHorizontal: number,
): [number, number][] {
  if (maxHorizontal === 1) {
    return Array(columnCount)
      .fill(0)
      .map((_, i) => [i, i]);
  }
  const ranges: [number, number][] = [[0, maxHorizontal - 1]];
  for (let c = 1; c <= columnCount; c++) {
    const evenOddModifier = c % 2 === 0 ? 0 : -1;
    ranges[c] = [
      ranges[c - 1][1] + 1,
      ranges[c - 1][1] + maxHorizontal + evenOddModifier,
    ];
  }
  return ranges;
}

function getColumnCount(tileCount: number, maxHorizontal: number): number {
  if (maxHorizontal === 1) return tileCount;
  let columnCount = 0;
  let i = 0;
  while (i <= tileCount) {
    i += columnCount % 2 === 0 ? maxHorizontal : maxHorizontal - 1;
    columnCount++;
  }
  return columnCount;
}

function getMultipliers(
  i: number,
  ranges: [number, number][],
): { x: number; y: number } {
  const y = ranges.findIndex((range) => i >= range[0] && i <= range[1]);
  const x = i - ranges[y][0] + (y % 2 === 0 ? 0 : 0.5);
  return { x, y };
}

export function TiledHexagons({
  tiles = [],
  tileGap = 2,
  maxHorizontal = 5,
  animated = true,
}: TiledHexagonsProps) {
  const tileCount = tiles.length;
  const columnCount = getColumnCount(tileCount, maxHorizontal);
  const xConst = HEX_WIDTH + tileGap;
  /** Rows nest in valleys, so vertical step is 3/4 of full height */
  const yConst = (3 / 4) * HEX_HEIGHT + tileGap;
  const numColsFirstRow =
    maxHorizontal === 1 ? 1 : Math.min(tileCount, maxHorizontal);
  const fullWidth =
    maxHorizontal === 1
      ? TILE_SIZE
      : (numColsFirstRow - 1) * xConst + TILE_SIZE;
  const fullHeight = (columnCount - 1) * yConst + TILE_SIZE;
  const ranges = getRanges(columnCount, maxHorizontal);

  return (
    <div
      style={{
        position: 'relative',
        width: fullWidth,
        height: fullHeight,
      }}
    >
      {tiles.map((tile, i) => {
        const { x, y } = getMultipliers(i, ranges);
        const label = tile.label ?? tile.text ?? '';

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x * xConst,
              top: y * yConst,
              width: TILE_SIZE,
              height: TILE_SIZE,
            }}
          >
            <HexagonButton
              label={label}
              lowerLabel={tile.lowerLabel}
              active={tile.active}
              animated={animated}
              onClick={tile.onClick}
            />
          </div>
        );
      })}
    </div>
  );
}
