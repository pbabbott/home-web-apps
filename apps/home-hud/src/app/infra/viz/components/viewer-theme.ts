import {
  neutral,
  primary,
  secondary,
  accentPurple,
} from '@abbottland/fui-components';

/**
 * Maps fui-components design tokens to the color values ModelViewer's
 * lighting rig and background need. Keep this file as the only place a
 * viewer reaches into brandColors — models should take plain hex strings
 * via their own config (see models/nas/config.ts).
 */
export const VIEWER_THEME = {
  background: neutral[950],
  ambientLight: neutral[400],
  keyLight: '#FFFFFF',
  rimLight: secondary.DEFAULT,
  accentLight: accentPurple.DEFAULT,
  gridLine: primary[700],
} as const;
