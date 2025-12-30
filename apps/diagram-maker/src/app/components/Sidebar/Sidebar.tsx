'use client';

import type { NodeColorScheme, HandleConfig } from '@abbottland/fui-components';
import { HorizontalRule } from '@abbottland/fui-components';
import { NodesSection } from './NodesSection';
import { SelectionInfo } from './SelectionInfo';
import { ColorSchemeControl } from './ColorSchemeControl';
import { HandlesControl } from './HandlesControl';
import { LayerControls } from './LayerControls';

interface SidebarProps {
  selectedNodeIds: string[];
  onSendToFront: () => void;
  onSendToBack: () => void;
  selectedColorScheme?: NodeColorScheme;
  onColorSchemeChange: (colorScheme: NodeColorScheme) => void;
  selectedHandles?: HandleConfig[];
  onHandlesChange: (handles: HandleConfig[]) => void;
}

export function Sidebar({
  selectedNodeIds,
  onSendToFront,
  onSendToBack,
  selectedColorScheme,
  onColorSchemeChange,
  selectedHandles,
  onHandlesChange,
}: SidebarProps) {
  const hasSelection = selectedNodeIds.length > 0;
  const handles = selectedHandles ?? [];

  return (
    <aside className="w-64 bg-neutral-800 border-r border-neutral-300 p-4 flex flex-col gap-4 overflow-y-auto">
      <NodesSection />
      <HorizontalRule color="secondary" />

      <SelectionInfo selectedNodeIds={selectedNodeIds} />

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden flex flex-col gap-4 ${
          hasSelection
            ? 'opacity-100 max-h-[500px]'
            : 'opacity-0 max-h-0 pointer-events-none'
        }`}
      >
        <ColorSchemeControl
          selectedColorScheme={selectedColorScheme}
          onColorSchemeChange={onColorSchemeChange}
          hasSelection={hasSelection}
        />

        <HandlesControl
          handles={handles}
          onHandlesChange={onHandlesChange}
          hasSelection={hasSelection}
        />

        <LayerControls
          onSendToFront={onSendToFront}
          onSendToBack={onSendToBack}
          hasSelection={hasSelection}
        />
      </div>
    </aside>
  );
}
