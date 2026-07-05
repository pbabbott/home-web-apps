'use client';

import { OutlinedButton, Typography } from '@abbottland/fui-components';
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
        <OutlinedButton
          onClick={() => onAlignNodes('left')}
          color="primary"
          className="flex-1 flex items-center justify-center"
          title="Align left"
        >
          <PinLeftIcon width={16} height={16} />
        </OutlinedButton>
        <OutlinedButton
          onClick={() => onAlignNodes('center-h')}
          color="primary"
          className="flex-1 flex items-center justify-center"
          title="Align center"
        >
          <AlignCenterVerticallyIcon width={16} height={16} />
        </OutlinedButton>
        <OutlinedButton
          onClick={() => onAlignNodes('right')}
          color="primary"
          className="flex-1 flex items-center justify-center"
          title="Align right"
        >
          <PinRightIcon width={16} height={16} />
        </OutlinedButton>
      </div>
      <div className="flex gap-2">
        <OutlinedButton
          onClick={() => onAlignNodes('top')}
          color="primary"
          className="flex-1 flex items-center justify-center"
          title="Align top"
        >
          <PinTopIcon width={16} height={16} />
        </OutlinedButton>
        <OutlinedButton
          onClick={() => onAlignNodes('center-v')}
          color="primary"
          className="flex-1 flex items-center justify-center"
          title="Align middle"
        >
          <AlignCenterHorizontallyIcon width={16} height={16} />
        </OutlinedButton>
        <OutlinedButton
          onClick={() => onAlignNodes('bottom')}
          color="primary"
          className="flex-1 flex items-center justify-center"
          title="Align bottom"
        >
          <PinBottomIcon width={16} height={16} />
        </OutlinedButton>
      </div>
    </div>
  );
}
