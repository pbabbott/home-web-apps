'use client';

import { Button, Typography } from '@abbottland/fui-components';
import {
  PinLeftIcon,
  AlignCenterHorizontallyIcon,
  PinRightIcon,
  PinTopIcon,
  AlignCenterVerticallyIcon,
  PinBottomIcon,
} from '@radix-ui/react-icons';
import { useDiagramEditor } from '../../DiagramEditorContext';

export function AlignmentControls() {
  const { onAlignNodes } = useDiagramEditor();

  return (
    <div>
      <Typography
        variant="body1"
        component="p"
        className="text-primary-300 mb-2"
      >
        Align Nodes
      </Typography>
      <div className="flex gap-2 mb-2">
        <Button
          onClick={() => onAlignNodes('left')}
          color="primary"
          variant="outlined"
          className="flex-1 flex items-center justify-center"
          title="Align left"
        >
          <PinLeftIcon width={16} height={16} />
        </Button>
        <Button
          onClick={() => onAlignNodes('center-h')}
          color="primary"
          variant="outlined"
          className="flex-1 flex items-center justify-center"
          title="Align center"
        >
          <AlignCenterVerticallyIcon width={16} height={16} />
        </Button>
        <Button
          onClick={() => onAlignNodes('right')}
          color="primary"
          variant="outlined"
          className="flex-1 flex items-center justify-center"
          title="Align right"
        >
          <PinRightIcon width={16} height={16} />
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => onAlignNodes('top')}
          color="primary"
          variant="outlined"
          className="flex-1 flex items-center justify-center"
          title="Align top"
        >
          <PinTopIcon width={16} height={16} />
        </Button>
        <Button
          onClick={() => onAlignNodes('center-v')}
          color="primary"
          variant="outlined"
          className="flex-1 flex items-center justify-center"
          title="Align middle"
        >
          <AlignCenterHorizontallyIcon width={16} height={16} />
        </Button>
        <Button
          onClick={() => onAlignNodes('bottom')}
          color="primary"
          variant="outlined"
          className="flex-1 flex items-center justify-center"
          title="Align bottom"
        >
          <PinBottomIcon width={16} height={16} />
        </Button>
      </div>
    </div>
  );
}
