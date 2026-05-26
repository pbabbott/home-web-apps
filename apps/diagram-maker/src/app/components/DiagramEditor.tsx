'use client';

import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  neutral,
  EditableEdge,
  DefaultEdge,
  DefaultNode,
  LabeledNode,
  TextNode,
} from '@abbottland/fui-components';
import { useDiagramEditor } from './DiagramEditorContext';

const nodeTypes: NodeTypes = {
  labeled: LabeledNode,
  customDefault: DefaultNode,
  text: TextNode,
};

const edgeTypes: EdgeTypes = {
  editable: EditableEdge,
  default: DefaultEdge,
};

export function DiagramEditor() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onDrop,
    onDragOver,
    onInit,
  } = useDiagramEditor();

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onInit={onInit}
      onDrop={onDrop}
      onDragOver={onDragOver}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={{
        type: 'basic',
        style: { stroke: neutral[300], strokeWidth: 2 },
        markerEnd: {
          type: 'arrowclosed',
        },
      }}
      deleteKeyCode={['Backspace', 'Delete']}
      connectOnClick={true}
      nodesConnectable={true}
      fitView
      className="bg-secondary-950"
    >
      <Controls className="!bg-secondary-800 !border-secondary-700 !rounded-lg [&>button]:!bg-secondary-700 [&>button]:!border-secondary-600 [&>button:hover]:!bg-secondary-600 [&>button>svg]:!fill-white" />
      <MiniMap
        className="!bg-secondary-800 !border-secondary-700 !rounded-lg"
        nodeColor="#6366f1"
        maskColor="rgba(0, 0, 0, 0.5)"
      />
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="#374151"
      />
    </ReactFlow>
  );
}
