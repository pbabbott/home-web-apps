'use client';

import { useState } from 'react';
import { Button } from '@abbottland/fui-components';
import { EyeOpenIcon, Pencil1Icon } from '@radix-ui/react-icons';
import { useDiagramEditor } from './DiagramEditorContext';
import { ExportPanel, ImportExportModal, Tab } from './ExportPanel';

const isLocal = process.env.NODE_ENV === 'development';

export function Header() {
  const {
    getExportData,
    onImport,
    viewerMode,
    onToggleViewerMode,
    activeLocalDiagramPath,
  } = useDiagramEditor();
  const [modalTab, setModalTab] = useState<Tab | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const exportData = getExportData();

  const handleSave = async () => {
    if (!activeLocalDiagramPath) return;
    setSaving(true);
    try {
      await fetch('/api/local-diagrams/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: activeLocalDiagramPath,
          data: getExportData(),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save diagram:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between bg-neutral-900 border-b border-neutral-300">
      <div className="flex items-center gap-2">
        <ExportPanel
          onClick={() => setModalTab('export')}
          onLoadLocalDiagrams={() => setModalTab('local-diagrams')}
          nodeCount={exportData.nodes.length}
          edgeCount={exportData.edges.length}
        />
        {isLocal && activeLocalDiagramPath && (
          <Button
            onClick={handleSave}
            color="primary"
            variant="contained"
            disabled={saving}
          >
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save'}
          </Button>
        )}
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
