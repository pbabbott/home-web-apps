'use client';

import { Button } from '@abbottland/fui-components';
import { EyeOpenIcon, Pencil1Icon } from '@radix-ui/react-icons';
import { useDiagramEditor } from './DiagramEditorContext';
import { ExportPanel } from './ExportPanel';
import { TipsSection } from './Sidebar/TipsSection';

export function Header() {
  const { getExportData, onImport, viewerMode, onToggleViewerMode } =
    useDiagramEditor();

  return (
    <div className="flex items-center justify-between bg-neutral-900 border-b border-neutral-300">
      <div className="flex items-center gap-2">
        <ExportPanel getExportData={getExportData} onImport={onImport} />
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
      <div className="pr-3">
        <TipsSection />
      </div>
    </div>
  );
}
