'use client';

import { useState, useEffect } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Button, Typography } from '@abbottland/fui-components';
import * as Checkbox from '@radix-ui/react-checkbox';
import { CheckIcon, CopyIcon, Cross2Icon } from '@radix-ui/react-icons';
import { useDiagramEditor } from '../DiagramEditorContext';
import { resolveUrl } from '@/lib/url';

export type Tab = 'export' | 'import' | 'local-diagrams';

const isLocal = process.env.NODE_ENV === 'development';

interface LocalDiagram {
  label: string;
  filePath: string;
  blogPost: string;
  isComplete: boolean;
  data: { nodes: Node[]; edges: Edge[] };
}

interface ImportExportModalProps {
  data: { nodes: Node[]; edges: Edge[] };
  onImport: (data: { nodes: Node[]; edges: Edge[] }) => void;
  onClose: () => void;
  defaultTab?: Tab;
}

export function ImportExportModal({
  data,
  onImport,
  onClose,
  defaultTab = 'export',
}: ImportExportModalProps) {
  const { onLoadLocalDiagram } = useDiagramEditor();
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [localDiagrams, setLocalDiagrams] = useState<LocalDiagram[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(false);

  const toggleCompleted = (filePath: string, current: boolean) => {
    const isComplete = !current;
    setLocalDiagrams((prev) =>
      prev.map((d) => (d.filePath === filePath ? { ...d, isComplete } : d)),
    );
    fetch(resolveUrl('/api/local-diagrams/complete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, isComplete }),
    }).catch(console.error);
  };

  useEffect(() => {
    if (!isLocal || activeTab !== 'local-diagrams') return;
    setLoadingLocal(true);
    fetch(resolveUrl('/api/local-diagrams'))
      .then((r) => r.json())
      .then((d: LocalDiagram[]) => setLocalDiagrams(d))
      .catch(console.error)
      .finally(() => setLoadingLocal(false));
  }, [activeTab]);

  const handleCopyToClipboard = async () => {
    const json = JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
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

  const handleImport = () => {
    setImportError(null);
    try {
      const parsed = JSON.parse(importText);
      if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
        throw new Error('Invalid JSON: missing "nodes" array');
      }
      if (!parsed.edges || !Array.isArray(parsed.edges)) {
        throw new Error('Invalid JSON: missing "edges" array');
      }
      onImport(parsed);
      onClose();
      setImportText('');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  const tabClass = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
      activeTab === tab
        ? 'border-primary-500 text-primary-400'
        : 'border-transparent text-secondary-400 hover:text-secondary-200'
    }`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-4 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <Typography variant="h3" component="h3">
            Import / Export
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

        <div className="flex border-b border-secondary-700 mb-4">
          <button
            className={tabClass('export')}
            onClick={() => setActiveTab('export')}
          >
            Export
          </button>
          <button
            className={tabClass('import')}
            onClick={() => setActiveTab('import')}
          >
            Import
          </button>
          {isLocal && (
            <button
              className={tabClass('local-diagrams')}
              onClick={() => setActiveTab('local-diagrams')}
            >
              Local Diagrams
            </button>
          )}
        </div>

        {activeTab === 'export' && (
          <>
            <pre className="flex-1 overflow-auto bg-secondary-900 rounded-lg p-4 text-sm text-secondary-300 font-mono">
              {JSON.stringify(data, null, 2)}
            </pre>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                onClick={handleCopyToClipboard}
                color="primary"
                variant="contained"
                className="flex items-center gap-2"
              >
                <CopyIcon width={16} height={16} />
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </Button>
            </div>
          </>
        )}

        {activeTab === 'import' && (
          <>
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
          </>
        )}

        {activeTab === 'local-diagrams' && isLocal && (
          <>
            {loadingLocal ? (
              <Typography
                variant="body1"
                component="p"
                className="text-secondary-400"
              >
                Loading...
              </Typography>
            ) : localDiagrams.length === 0 ? (
              <Typography
                variant="body1"
                component="p"
                className="text-secondary-400"
              >
                No diagram JSON files found in blog content.
              </Typography>
            ) : (
              <ul className="flex-1 overflow-auto flex flex-col gap-1 pr-2">
                {localDiagrams.map((diagram) => (
                  <li
                    key={diagram.filePath}
                    className="flex items-stretch gap-2"
                  >
                    <button
                      onClick={() => {
                        onLoadLocalDiagram(
                          diagram.filePath,
                          diagram.data,
                          diagram.isComplete,
                          diagram.label,
                        );
                        onClose();
                      }}
                      className={`flex-1 text-left px-4 py-3 rounded-lg border transition-colors ${diagram.isComplete ? 'bg-success-900 hover:bg-success-800 border-success-500 hover:border-success-400' : 'bg-secondary-900 hover:bg-secondary-700 border-secondary-700 hover:border-primary-500'}`}
                    >
                      <Typography
                        variant="body1"
                        component="span"
                        className={`block ${diagram.isComplete ? 'text-neutral-300' : 'text-secondary-100'}`}
                      >
                        {diagram.label}
                      </Typography>
                      <Typography
                        variant="body2"
                        component="span"
                        className="block text-secondary-400 mt-0.5"
                      >
                        {diagram.blogPost}
                      </Typography>
                    </button>
                    <Checkbox.Root
                      checked={diagram.isComplete}
                      onCheckedChange={() =>
                        toggleCompleted(diagram.filePath, diagram.isComplete)
                      }
                      title="Mark complete"
                      className="flex items-center justify-center w-10 shrink-0 rounded-lg bg-secondary-900 border border-secondary-700 hover:border-success-400 transition-colors cursor-pointer"
                    >
                      <Checkbox.Indicator>
                        <CheckIcon className="text-success-400 w-4 h-4" />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
