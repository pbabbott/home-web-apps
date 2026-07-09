'use client';

import {
  DiagramViewer as BaseDiagramViewer,
  type DiagramViewerProps,
} from '@abbottland/fui-components';
import { renderSimpleIcon } from '@abbottland/fui-icons';
import { useAnimationsContext } from '@/context/Animations.Context';

export function DiagramViewer(props: DiagramViewerProps) {
  const { animationsEnabled } = useAnimationsContext();
  return (
    <BaseDiagramViewer
      animated={animationsEnabled}
      {...props}
      renderIcon={renderSimpleIcon}
    />
  );
}

export type { DiagramViewerProps };
