'use client';

import { useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  NodeTypes,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { LabeledNode } from './nodes/LabeledNode';
import { DefaultNode } from './nodes/DefaultNode';
import { TextNode } from './nodes/TextNode';

export interface DiagramViewerProps {
  data: {
    nodes: Node[];
    edges: Edge[];
  };
  height?: string;
  className?: string;
}

// Define nodeTypes outside to prevent re-renders
const nodeTypes: NodeTypes = {
  labeled: LabeledNode,
  customDefault: DefaultNode,
  text: TextNode,
};

export function DiagramViewer({
  data,
  height = '600px',
  className = '',
}: DiagramViewerProps) {
  // Memoize nodes and edges to prevent unnecessary re-renders
  const nodes = useMemo(() => data.nodes, [data.nodes]);
  const edges = useMemo(() => data.edges, [data.edges]);

  return (
    <div
      className={`w-full rounded-lg overflow-hidden border border-neutral-700 ${className}`}
      style={{ height }}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          className="bg-secondary-950"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#374151"
          />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
