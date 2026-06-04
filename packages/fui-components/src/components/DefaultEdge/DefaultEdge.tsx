'use client';

import { type EdgeProps } from '@xyflow/react';
import { BaseEdge } from '../BaseEdge/BaseEdge';

export function DefaultEdge(props: EdgeProps) {
  return <BaseEdge {...props} editable={false} />;
}
