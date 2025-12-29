'use client';

import { useState } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Button, Typography } from '@abbottland/fui-components';
import {
  CopyIcon,
  EyeOpenIcon,
  EyeClosedIcon,
  Cross2Icon,
  UploadIcon,
} from '@radix-ui/react-icons';

interface ExportPanelProps {
  getExportData: () => { nodes: Node[]; edges: Edge[] };
  onImport: (data: { nodes: Node[]; edges: Edge[] }) => void;
}

export function ExportPanel({ getExportData, onImport }: ExportPanelProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const handleExport = async () => {
    const data = getExportData();
    const json = JSON.stringify(data, null, 2);

    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

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
      setShowImport(false);
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

  const exportData = getExportData();

  return (
    <>
      <div className="flex items-center gap-2 p-3">
        <Button
          onClick={handleExport}
          color="primary"
          variant="contained"
          className="flex items-center gap-2"
        >
          <CopyIcon width={16} height={16} />
          {copied ? 'Copied!' : 'Copy JSON'}
        </Button>

        <Button
          onClick={() => setShowPreview(!showPreview)}
          color="secondary"
          variant="outlined"
          className="flex items-center gap-2"
        >
          {showPreview ? (
            <>
              <EyeClosedIcon width={16} height={16} />
              Hide Preview
            </>
          ) : (
            <>
              <EyeOpenIcon width={16} height={16} />
              Preview JSON
            </>
          )}
        </Button>

        <Button
          onClick={() => {
            setShowImport(true);
            setImportText('');
            setImportError(null);
          }}
          color="secondary"
          variant="outlined"
          className="flex items-center gap-2"
        >
          <UploadIcon width={16} height={16} />
          Import JSON
        </Button>
      </div>

      <div className="flex-1" />

      <Typography variant="body1" component="div" className="pr-3">
        {exportData.nodes.length} nodes · {exportData.edges.length} edges
      </Typography>

      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-4 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <Typography variant="h3" component="h3">
                JSON Preview
              </Typography>
              <Button
                onClick={() => setShowPreview(false)}
                color="secondary"
                variant="text"
                className="text-secondary-400 hover:text-white"
              >
                <Cross2Icon width={20} height={20} />
              </Button>
            </div>
            <pre className="flex-1 overflow-auto bg-secondary-900 rounded-lg p-4 text-sm text-secondary-300 font-mono">
              {JSON.stringify(exportData, null, 2)}
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
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-4 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <Typography variant="h3" component="h3">
                Import JSON
              </Typography>
              <Button
                onClick={() => setShowImport(false)}
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
                <Button
                  onClick={() => setShowImport(false)}
                  color="secondary"
                  variant="outlined"
                >
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
      )}
    </>
  );
}
