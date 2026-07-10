'use client';

import {
  DiagramViewer as BaseDiagramViewer,
  type DiagramViewerProps,
} from '@abbottland/fui-components';
import { renderSimpleIcon } from '@abbottland/fui-icons';
import { usePathname } from 'next/navigation';
import { useAnimationsContext } from '@/context/Animations.Context';
import { trackEvent } from '@/lib/umami';

interface BlogDiagramViewerProps extends DiagramViewerProps {
  /** Diagram identifier logged with the fullscreen-click analytics event. */
  name: string;
}

export function DiagramViewer({
  name,
  onFullscreenClick,
  ...props
}: BlogDiagramViewerProps) {
  const { animationsEnabled } = useAnimationsContext();
  const pathname = usePathname();

  return (
    <BaseDiagramViewer
      animated={animationsEnabled}
      {...props}
      renderIcon={renderSimpleIcon}
      onFullscreenClick={(next) => {
        trackEvent('diagram_fullscreen', {
          diagram: name,
          page: pathname,
          fullscreen: next,
        });
        onFullscreenClick?.(next);
      }}
    />
  );
}

export type { DiagramViewerProps };
