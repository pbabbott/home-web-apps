'use client';

import { useState } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Button, Typography } from '@abbottland/fui-components';
import { MixerHorizontalIcon } from '@radix-ui/react-icons';
import { ImportExportModal } from './ImportExportModal';

interface ExportPanelProps {
  getExportData: () => { nodes: Node[]; edges: Edge[] };
  onImport: (data: { nodes: Node[]; edges: Edge[] }) => void;
}

export function ExportPanel({ getExportData, onImport }: ExportPanelProps) {
  const [showModal, setShowModal] = useState(false);

  const exportData = getExportData();

  return (
    <>
      <div className="flex items-center gap-2 p-3">
        <Button
          onClick={() => setShowModal(true)}
          color="secondary"
          variant="outlined"
          className="flex items-center gap-2"
        >
          <MixerHorizontalIcon width={16} height={16} />
          Import / Export
        </Button>

        <Typography variant="body1" component="div" className="pr-3">
          {exportData.nodes.length} nodes | {exportData.edges.length} edges
        </Typography>
      </div>

      {showModal && (
        <ImportExportModal
          data={exportData}
          onImport={onImport}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
