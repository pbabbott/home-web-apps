'use client';

import { HorizontalRule } from '@abbottland/fui-components';
import { useDiagramEditor } from '../DiagramEditorContext';
import { NodesSection } from './Nodes/NodesSection';
import { SelectionInfo } from './SelectionInfo';
import { ColorSchemeControl } from './NodeProps/ColorSchemeControl';
import { HandlesControl } from './NodeProps/HandlesControl';
import { LayerControls } from './NodeProps/LayerControls';
import { EdgeTypeControl } from './EdgeProps/EdgeTypeControl';
import { EdgeLabelColorControl } from './EdgeProps/EdgeLabelColorControl';
import { EdgeActiveControl } from './EdgeProps/EdgeActiveControl';
import { NodeTypeControl } from './NodeProps/NodeTypeControl';
import { IconControl } from './NodeProps/IconControl';
import { TransparentBackgroundControl } from './NodeProps/TransparentBackgroundControl';
import { AlignmentControls } from './MultiNodeProps/AlignmentControls';

export function Sidebar() {
  const { selectedNodeIds, selectedEdgeIds } = useDiagramEditor();
  const hasSingleNodeSelection = selectedNodeIds.length === 1;
  const hasMultiNodeSelection = selectedNodeIds.length > 1;
  const hasSingleEdgeSelection = selectedEdgeIds.length === 1;

  return (
    <aside className="w-64 h-full bg-neutral-800 border-r border-neutral-300 p-4 flex flex-col gap-4 overflow-y-auto">
      <NodesSection />
      <HorizontalRule color="secondary" />

      <SelectionInfo />

      {/* Node-specific controls (single-node selection only) */}
      <div
        className={`transition-all duration-300 ease-in-out flex flex-col gap-4 ${
          hasSingleNodeSelection
            ? 'opacity-100'
            : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'
        }`}
      >
        <NodeTypeControl />
        <IconControl />
        <ColorSchemeControl />
        <TransparentBackgroundControl />
        <HandlesControl />
        <LayerControls />
      </div>

      {/* Multi-node controls (2+ nodes selected, regardless of edge selection) */}
      <div
        className={`transition-all duration-300 ease-in-out flex flex-col gap-4 ${
          hasMultiNodeSelection
            ? 'opacity-100'
            : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'
        }`}
      >
        <AlignmentControls />
      </div>

      {/* Edge-specific controls (single-edge selection only) */}
      <div
        className={`transition-all duration-300 ease-in-out flex flex-col gap-4 ${
          hasSingleEdgeSelection
            ? 'opacity-100'
            : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'
        }`}
      >
        <EdgeTypeControl />
        <EdgeLabelColorControl />
        <EdgeActiveControl />
      </div>
    </aside>
  );
}
