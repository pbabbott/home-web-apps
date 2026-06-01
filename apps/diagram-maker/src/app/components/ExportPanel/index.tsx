'use client';

import { Button, Typography } from '@abbottland/fui-components';
import { MixerHorizontalIcon } from '@radix-ui/react-icons';

const isLocal = process.env.NODE_ENV === 'development';

interface ExportPanelProps {
  onClick: () => void;
  onLoadLocalDiagrams: () => void;
  nodeCount: number;
  edgeCount: number;
}

export function ExportPanel({
  onClick,
  onLoadLocalDiagrams,
  nodeCount,
  edgeCount,
}: ExportPanelProps) {
  return (
    <div className="flex items-center gap-2 p-3">
      <Button
        onClick={onClick}
        color="secondary"
        variant="outlined"
        className="flex items-center gap-2"
      >
        <MixerHorizontalIcon width={16} height={16} />
        Import / Export
      </Button>

      {isLocal && (
        <Button
          onClick={onLoadLocalDiagrams}
          color="accent-falcon"
          variant="outlined"
        >
          Local Diagrams
        </Button>
      )}

      <Typography variant="body1" component="div" className="pr-3">
        {nodeCount} nodes | {edgeCount} edges
      </Typography>
    </div>
  );
}

export { ImportExportModal } from './ImportExportModal';
export type { Tab } from './ImportExportModal';
