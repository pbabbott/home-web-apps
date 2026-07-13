/**
 * Brand color themes for HexagonalBackground (grid + spark effect).
 */

import { neutral, primary, secondary, error } from '../../tokens';

/** Convert 6-char hex to rgba string for opacity variants */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export type HexagonalBackgroundTheme = 'default' | 'ice' | 'error';

export type HexagonalBackgroundColors = {
  bg: string;
  hexStroke: string;
  hexFill: string;
  sparkCore: string;
  sparkGlow: string;
  sparkHead: string;
};

export const themes: Record<
  HexagonalBackgroundTheme,
  HexagonalBackgroundColors
> = {
  default: {
    bg: neutral[1000],
    hexStroke: hexToRgba(primary[700], 0.1),
    hexFill: 'rgba(0,0,0,0)',
    sparkCore: primary[500],
    sparkGlow: primary[700],
    sparkHead: primary[200],
  },
  ice: {
    bg: neutral[300],
    hexStroke: hexToRgba(secondary[700], 0.15),
    hexFill: 'rgba(0,0,0,0)',
    sparkCore: secondary[600],
    sparkGlow: secondary[800],
    sparkHead: secondary[900],
  },
  error: {
    bg: neutral[300],
    hexStroke: hexToRgba(error[700], 0.15),
    hexFill: 'rgba(0,0,0,0)',
    sparkCore: error[600],
    sparkGlow: error[800],
    sparkHead: error[900],
  },
};
