'use client';

import { MiniMap } from '@xyflow/react';
import { accentFalcon } from '../../tokens/colors';

export function DiagramMinimap() {
  return (
    <MiniMap
      className="!bg-accent-falcon-700 !border-accent-falcon-600 !rounded-lg"
      nodeColor={accentFalcon[400]}
      maskColor="rgba(0, 0, 0, 0.5)"
    />
  );
}
