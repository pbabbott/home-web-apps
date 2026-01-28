'use client';

import { useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  NodeTypes,
  EdgeTypes,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DefaultEdge, EditableEdge } from '@abbottland/fui-components';
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

// Define edgeTypes outside to prevent re-renders
const edgeTypes: EdgeTypes = {
  editable: EditableEdge,
  default: DefaultEdge,
};

export function DiagramViewer({
  data,
  height = '600px',
  className = '',
}: DiagramViewerProps) {
  // Memoize nodes and edges to prevent unnecessary re-renders
  const nodes = useMemo(() => data.nodes, [data.nodes]);
  // Make all edges readonly in the viewer
  const edges = useMemo(
    () =>
      data.edges.map((edge) => ({
        ...edge,
        data: { ...edge.data, readonly: true },
      })),
    [data.edges],
  );

  return (
    <div
      className={`w-full rounded-lg overflow-hidden border border-neutral-700 ${className}`}
      style={{ height }}
    >
      <style>{`
        .react-flow__edges {
          z-index: 10;
        }
        .react-flow__nodes {
          z-index: 1;
        }
      `}</style>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
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
