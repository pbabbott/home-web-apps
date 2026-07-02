'use client';

import { useState } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Button, Typography } from '@abbottland/fui-components';
import { Cross2Icon } from '@radix-ui/react-icons';
import { ExportTab } from './ExportTab';
import { ImportTab } from './ImportTab';
import { LocalDiagramsTab } from './LocalDiagramsTab';
import { isLocal, type Tab } from './types';

export type { Tab } from './types';

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
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const tabClass = (tab: Tab) =>
    `px-4 py-2 font-monobit text-button uppercase tracking-[.1em] border-b-2 transition-colors cursor-pointer ${
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

        {activeTab === 'export' && <ExportTab data={data} />}

        {activeTab === 'import' && (
          <ImportTab onImport={onImport} onClose={onClose} />
        )}

        {activeTab === 'local-diagrams' && isLocal && (
          <LocalDiagramsTab onClose={onClose} />
        )}
      </div>
    </div>
  );
}
