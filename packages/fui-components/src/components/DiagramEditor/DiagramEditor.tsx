'use client';

import type { DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { neutral } from '../../tokens/colors';
import {
  nodeTypes,
  edgeTypes,
  diagramContainerClass,
  diagramFlowStyles,
  diagramProOptions,
} from '../diagramShared';
import { DiagramControls } from '../DiagramControls/DiagramControls';
import { DiagramMinimap } from '../DiagramMinimap/DiagramMinimap';

export interface DiagramEditorProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (params: Connection) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onInit?: (instance: ReactFlowInstance) => void;
  deleteKeyCode?: string | string[] | null;
  height?: string;
  className?: string;
}

const defaultEdgeOptions = {
  type: 'basic',
  style: { stroke: neutral[300], strokeWidth: 2 },
  markerEnd: { type: 'arrowclosed' as const },
};

export function DiagramEditor({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onDrop,
  onDragOver,
  onInit,
  deleteKeyCode = ['Backspace', 'Delete'],
  height,
  className = '',
}: DiagramEditorProps) {
  return (
    <div
      className={`${diagramContainerClass} ${className}`}
      style={height ? { height } : undefined}
    >
      <style>{diagramFlowStyles}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={onInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        deleteKeyCode={deleteKeyCode}
        connectOnClick={true}
        nodesConnectable={true}
        fitView
        proOptions={diagramProOptions}
        className="h-full"
      >
        <DiagramControls />
        <DiagramMinimap />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={2}
          color={neutral[800]}
        />
      </ReactFlow>
    </div>
  );
}
