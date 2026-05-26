'use client';

import { useState } from 'react';
import { Button } from '@abbottland/fui-components';
import { EyeOpenIcon, Pencil1Icon } from '@radix-ui/react-icons';
import { useDiagramEditor } from './DiagramEditorContext';
import { ExportPanel, ImportExportModal, Tab } from './ExportPanel';

export function Header() {
  const { getExportData, onImport, viewerMode, onToggleViewerMode } =
    useDiagramEditor();
  const [modalTab, setModalTab] = useState<Tab | null>(null);
  const exportData = getExportData();

  return (
    <div className="flex items-center justify-between bg-neutral-900 border-b border-neutral-300">
      <div className="flex items-center gap-2">
        <ExportPanel
          onClick={() => setModalTab('export')}
          onLoadPreset={() => setModalTab('presets')}
          nodeCount={exportData.nodes.length}
          edgeCount={exportData.edges.length}
        />
      </div>
      <div className="pr-3">
        <Button
          onClick={onToggleViewerMode}
          color="secondary"
          variant="outlined"
          className="flex items-center gap-2"
        >
          {viewerMode ? (
            <>
              <Pencil1Icon width={16} height={16} />
              Edit
            </>
          ) : (
            <>
              <EyeOpenIcon width={16} height={16} />
              Show in Viewer
            </>
          )}
        </Button>
      </div>
      {modalTab !== null && (
        <ImportExportModal
          data={exportData}
          onImport={onImport}
          onClose={() => setModalTab(null)}
          defaultTab={modalTab}
        />
      )}
    </div>
  );
}
