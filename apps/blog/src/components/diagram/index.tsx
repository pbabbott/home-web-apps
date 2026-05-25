'use client';

import {
  DiagramViewer as BaseDiagramViewer,
  type DiagramViewerProps,
} from '@abbottland/fui-components';
import { renderSimpleIcon } from '@abbottland/fui-icons';

export function DiagramViewer(props: DiagramViewerProps) {
  return <BaseDiagramViewer {...props} renderIcon={renderSimpleIcon} />;
}

export type { DiagramViewerProps };
