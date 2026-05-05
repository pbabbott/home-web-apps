'use client';

import { useState } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Button, Typography } from '@abbottland/fui-components';
import { CopyIcon, Cross2Icon } from '@radix-ui/react-icons';

interface ExportPreviewModalProps {
  data: { nodes: Node[]; edges: Edge[] };
  onClose: () => void;
}

export function ExportPreviewModal({ data, onClose }: ExportPreviewModalProps) {
  const [copied, setCopied] = useState(false);

  const handleExport = async () => {
    const json = JSON.stringify(data, null, 2);

    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-4 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <Typography variant="h3" component="h3">
            JSON Preview
          </Typography>
          <Button
            onClick={onClose}
            color="secondary"
            variant="text"
            className="text-secondary-400 hover:text-white"
          >
            <Cross2Icon width={20} height={20} />
          </Button>
        </div>
        <pre className="flex-1 overflow-auto bg-secondary-900 rounded-lg p-4 text-sm text-secondary-300 font-mono">
          {JSON.stringify(data, null, 2)}
        </pre>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            onClick={handleExport}
            color="primary"
            variant="contained"
            className="flex items-center gap-2"
          >
            <CopyIcon width={16} height={16} />
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </Button>
        </div>
      </div>
    </div>
  );
}
