'use client';

import { Typography, OutlinedButton } from '@abbottland/fui-components';
import { ChevronUpIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { useDiagramEditor } from '../../DiagramEditorContext';

export function LayerControls() {
  const { selectedNodeIds, onSendToFront, onSendToBack } = useDiagramEditor();
  const hasSelection = selectedNodeIds.length > 0;

  return (
    <div>
      <Typography
        variant="body1"
        component="p"
        className="text-primary-300 mb-2"
      >
        Layer Order
      </Typography>
      <div className="flex gap-2">
        <OutlinedButton
          onClick={onSendToFront}
          disabled={!hasSelection}
          color="primary"
          className="flex-1 flex items-center justify-center gap-1.5"
          title="Send to Front (renders on top)"
        >
          <ChevronUpIcon width={16} height={16} />
          Front
        </OutlinedButton>
        <OutlinedButton
          onClick={onSendToBack}
          disabled={!hasSelection}
          color="primary"
          className="flex-1 flex items-center justify-center gap-1.5"
          title="Send to Back (renders behind)"
        >
          <ChevronDownIcon width={16} height={16} />
          Back
        </OutlinedButton>
      </div>
    </div>
  );
}
