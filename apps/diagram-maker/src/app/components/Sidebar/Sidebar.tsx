'use client';

import type { NodeColorScheme, HandleConfig } from '@abbottland/fui-components';
import { HorizontalRule } from '@abbottland/fui-components';
import { NodesSection } from './NodesSection';
import { SelectionInfo } from './SelectionInfo';
import { ColorSchemeControl } from './ColorSchemeControl';
import { HandlesControl } from './HandlesControl';
import { LayerControls } from './LayerControls';
import { EdgeTypeControl } from './EdgeTypeControl';

interface SidebarProps {
  selectedNodeIds: string[];
  onSendToFront: () => void;
  onSendToBack: () => void;
  selectedColorScheme?: NodeColorScheme;
  onColorSchemeChange: (colorScheme: NodeColorScheme) => void;
  selectedHandles?: HandleConfig[];
  onHandlesChange: (handles: HandleConfig[]) => void;
  selectedEdgeIds: string[];
  selectedEdgeType?: string;
  onEdgeTypeChange: (edgeType: string) => void;
}

export function Sidebar({
  selectedNodeIds,
  onSendToFront,
  onSendToBack,
  selectedColorScheme,
  onColorSchemeChange,
  selectedHandles,
  onHandlesChange,
  selectedEdgeIds,
  selectedEdgeType,
  onEdgeTypeChange,
}: SidebarProps) {
  const hasNodeSelection = selectedNodeIds.length > 0;
  const hasEdgeSelection = selectedEdgeIds.length > 0;
  const hasSelection = hasNodeSelection || hasEdgeSelection;
  const handles = selectedHandles ?? [];

  return (
    <aside className="w-64 bg-neutral-800 border-r border-neutral-300 p-4 flex flex-col gap-4 overflow-y-auto">
      <NodesSection />
      <HorizontalRule color="secondary" />

      <SelectionInfo
        selectedNodeIds={selectedNodeIds}
        selectedEdgeIds={selectedEdgeIds}
      />

      {/* Node-specific controls */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden flex flex-col gap-4 ${
          hasNodeSelection
            ? 'opacity-100 max-h-[500px]'
            : 'opacity-0 max-h-0 pointer-events-none'
        }`}
      >
        <ColorSchemeControl
          selectedColorScheme={selectedColorScheme}
          onColorSchemeChange={onColorSchemeChange}
          hasSelection={hasNodeSelection}
        />

        <HandlesControl
          handles={handles}
          onHandlesChange={onHandlesChange}
          hasSelection={hasNodeSelection}
        />

        <LayerControls
          onSendToFront={onSendToFront}
          onSendToBack={onSendToBack}
          hasSelection={hasNodeSelection}
        />
      </div>

      {/* Edge-specific controls */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden flex flex-col gap-4 ${
          hasEdgeSelection
            ? 'opacity-100 max-h-[500px]'
            : 'opacity-0 max-h-0 pointer-events-none'
        }`}
      >
        <EdgeTypeControl
          selectedEdgeType={selectedEdgeType}
          onEdgeTypeChange={onEdgeTypeChange}
          hasSelection={hasEdgeSelection}
        />
      </div>
    </aside>
  );
}
