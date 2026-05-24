'use client';

import { HorizontalRule } from '@abbottland/fui-components';
import { useDiagramEditor } from '../DiagramEditorContext';
import { NodesSection } from './Nodes/NodesSection';
import { SelectionInfo } from './SelectionInfo';
import { ColorSchemeControl } from './NodeProps/ColorSchemeControl';
import { HandlesControl } from './NodeProps/HandlesControl';
import { LayerControls } from './NodeProps/LayerControls';
import { EdgeTypeControl } from './EdgeProps/EdgeTypeControl';
import { NodeTypeControl } from './NodeProps/NodeTypeControl';

export function Sidebar() {
  const { selectedNodeIds, selectedEdgeIds } = useDiagramEditor();
  const hasNodeSelection = selectedNodeIds.length > 0;
  const hasEdgeSelection = selectedEdgeIds.length > 0;

  return (
    <aside className="w-64 bg-neutral-800 border-r border-neutral-300 p-4 flex flex-col gap-4 overflow-y-auto">
      <NodesSection />
      <HorizontalRule color="secondary" />

      <SelectionInfo />

      {/* Node-specific controls */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden flex flex-col gap-4 ${
          hasNodeSelection
            ? 'opacity-100 max-h-[500px]'
            : 'opacity-0 max-h-0 pointer-events-none'
        }`}
      >
        <NodeTypeControl />
        <ColorSchemeControl />
        <HandlesControl />
        <LayerControls />
      </div>

      {/* Edge-specific controls */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden flex flex-col gap-4 ${
          hasEdgeSelection
            ? 'opacity-100 max-h-[500px]'
            : 'opacity-0 max-h-0 pointer-events-none'
        }`}
      >
        <EdgeTypeControl />
      </div>
    </aside>
  );
}
