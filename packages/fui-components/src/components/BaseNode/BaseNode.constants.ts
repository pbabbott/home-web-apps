export type HandlePosition = 'top' | 'bottom' | 'left' | 'right';
export type HandleType = 'source' | 'target';

export interface HandleConfig {
  id: string;
  type: HandleType;
  position: HandlePosition;
}

export const DEFAULT_HANDLES: HandleConfig[] = [];
export const MIN_WIDTH = 150;
export const MIN_HEIGHT = 80;
