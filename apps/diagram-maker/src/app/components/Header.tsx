'use client';

import { useState } from 'react';
import { Button, Typography } from '@abbottland/fui-components';
import * as Checkbox from '@radix-ui/react-checkbox';
import { CheckIcon, EyeOpenIcon, Pencil1Icon } from '@radix-ui/react-icons';
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
    activeLocalDiagramLabel,
    activeLocalDiagramIsComplete,
    onToggleActiveLocalDiagramComplete,
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
          isComplete: activeLocalDiagramIsComplete,
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
    <div
      className={`flex flex-col border-b transition-colors ${activeLocalDiagramIsComplete ? 'bg-success-900 border-success-700' : 'bg-neutral-900 border-neutral-300'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ExportPanel
            onClick={() => setModalTab('export')}
            onLoadLocalDiagrams={() => setModalTab('local-diagrams')}
            nodeCount={exportData.nodes.length}
            edgeCount={exportData.edges.length}
          />
          {isLocal && activeLocalDiagramPath && (
            <>
              <Button
                onClick={handleSave}
                color="primary"
                variant="contained"
                disabled={saving}
              >
                {saved ? 'Saved!' : saving ? 'Saving...' : 'Save'}
              </Button>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox.Root
                  checked={activeLocalDiagramIsComplete}
                  onCheckedChange={onToggleActiveLocalDiagramComplete}
                  className="flex items-center justify-center w-5 h-5 rounded border border-secondary-700 hover:border-success-400 transition-colors cursor-pointer shrink-0"
                >
                  <Checkbox.Indicator>
                    <CheckIcon className="text-success-400 w-4 h-4" />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <Typography
                  variant="caption"
                  component="span"
                  className="text-secondary-400"
                >
                  Complete
                </Typography>
              </label>
            </>
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
      </div>
      {activeLocalDiagramLabel && (
        <div className="px-3 pb-1">
          <Typography
            variant="caption"
            component="span"
            className={
              activeLocalDiagramIsComplete
                ? 'text-success-300'
                : 'text-neutral-400'
            }
          >
            {activeLocalDiagramLabel}
          </Typography>
        </div>
      )}
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
