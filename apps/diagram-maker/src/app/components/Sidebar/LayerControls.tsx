'use client';

import { Typography, Button } from '@abbottland/fui-components';
import { ChevronUpIcon, ChevronDownIcon } from '@radix-ui/react-icons';

interface LayerControlsProps {
  onSendToFront: () => void;
  onSendToBack: () => void;
  hasSelection: boolean;
}

export function LayerControls({
  onSendToFront,
  onSendToBack,
  hasSelection,
}: LayerControlsProps) {
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
        <Button
          onClick={onSendToFront}
          disabled={!hasSelection}
          color="primary"
          variant="outlined"
          className="flex-1 flex items-center justify-center gap-1.5"
          title="Send to Front (renders on top)"
        >
          <ChevronUpIcon width={16} height={16} />
          Front
        </Button>
        <Button
          onClick={onSendToBack}
          disabled={!hasSelection}
          color="primary"
          variant="outlined"
          className="flex-1 flex items-center justify-center gap-1.5"
          title="Send to Back (renders behind)"
        >
          <ChevronDownIcon width={16} height={16} />
          Back
        </Button>
      </div>
    </div>
  );
}
