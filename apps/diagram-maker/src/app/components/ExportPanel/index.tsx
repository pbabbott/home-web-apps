'use client';

import { useState } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Button, Typography } from '@abbottland/fui-components';
import { UploadIcon, DownloadIcon } from '@radix-ui/react-icons';
import { ExportPreviewModal } from './ExportPreviewModal';
import { ImportModal } from './ImportModal';

interface ExportPanelProps {
  getExportData: () => { nodes: Node[]; edges: Edge[] };
  onImport: (data: { nodes: Node[]; edges: Edge[] }) => void;
}

export function ExportPanel({ getExportData, onImport }: ExportPanelProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const exportData = getExportData();

  return (
    <>
      <div className="flex items-center gap-2 p-3">
        <Button
          onClick={() => setShowPreview(!showPreview)}
          color="secondary"
          variant="outlined"
          className="flex items-center gap-2"
        >
          <DownloadIcon width={16} height={16} />
          Export JSON
        </Button>

        <Button
          onClick={() => {
            setShowImport(true);
          }}
          color="secondary"
          variant="outlined"
          className="flex items-center gap-2"
        >
          <UploadIcon width={16} height={16} />
          Import JSON
        </Button>
      </div>

      <Typography variant="body1" component="div" className="pr-3">
        {exportData.nodes.length} nodes · {exportData.edges.length} edges
      </Typography>

      {showPreview && (
        <ExportPreviewModal
          data={exportData}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showImport && (
        <ImportModal onImport={onImport} onClose={() => setShowImport(false)} />
      )}
    </>
  );
}
