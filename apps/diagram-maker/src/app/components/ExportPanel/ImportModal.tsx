'use client';

import { useState } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Button, Typography } from '@abbottland/fui-components';
import { CopyIcon, Cross2Icon } from '@radix-ui/react-icons';

interface ImportModalProps {
  onImport: (data: { nodes: Node[]; edges: Edge[] }) => void;
  onClose: () => void;
}

export function ImportModal({ onImport, onClose }: ImportModalProps) {
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const handleImport = () => {
    setImportError(null);
    try {
      const data = JSON.parse(importText);

      // Validate the structure
      if (!data.nodes || !Array.isArray(data.nodes)) {
        throw new Error('Invalid JSON: missing "nodes" array');
      }
      if (!data.edges || !Array.isArray(data.edges)) {
        throw new Error('Invalid JSON: missing "edges" array');
      }

      onImport(data);
      onClose();
      setImportText('');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setImportText(text);
      setImportError(null);
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      setImportError('Failed to read from clipboard');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-4 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <Typography variant="h3" component="h3">
            Import JSON
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

        <Typography
          variant="body1"
          component="p"
          className="mb-2 text-secondary-400"
        >
          Paste your diagram JSON below:
        </Typography>

        <textarea
          value={importText}
          onChange={(e) => {
            setImportText(e.target.value);
            setImportError(null);
          }}
          className="flex-1 min-h-[200px] bg-secondary-900 text-secondary-200 rounded-lg p-4 text-sm font-mono outline-none border border-secondary-700 focus:border-primary-500 resize-none"
          placeholder='{"nodes": [...], "edges": [...]}'
        />

        {importError && (
          <Typography
            variant="body1"
            component="p"
            className="mt-2 text-red-400"
          >
            Error: {importError}
          </Typography>
        )}

        <div className="mt-4 flex justify-between gap-2">
          <Button
            onClick={handlePasteFromClipboard}
            color="secondary"
            variant="outlined"
            className="flex items-center gap-2"
          >
            <CopyIcon width={16} height={16} />
            Paste from Clipboard
          </Button>
          <div className="flex gap-2">
            <Button onClick={onClose} color="secondary" variant="outlined">
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              color="primary"
              variant="contained"
              disabled={!importText.trim()}
            >
              Import
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
