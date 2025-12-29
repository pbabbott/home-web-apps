'use client';

import { useCallback, useRef, useState, DragEvent } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Connection,
  Node,
  Edge,
  ReactFlowInstance,
  NodeTypes,
  useOnSelectionChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { neutral } from '@abbottland/fui-components';
import { Sidebar } from './Sidebar/Sidebar';
import { ExportPanel } from './ExportPanel';
import { LabeledNode } from './nodes/LabeledNode';
import { DefaultNode } from './nodes/DefaultNode';
import { TextNode } from './nodes/TextNode';
import {
  DEFAULT_HANDLES,
  type NodeColorScheme,
  type HandleConfig,
} from './nodes/BaseNode';

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

let id = 0;
const getId = () => `node_${id++}`;

// Define nodeTypes outside or memoize to prevent re-renders
const nodeTypes: NodeTypes = {
  labeled: LabeledNode,
  customDefault: DefaultNode,
  text: TextNode,
};

function DiagramEditorInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  // Track selected nodes
  useOnSelectionChange({
    onChange: ({ nodes: selectedNodes }) => {
      setSelectedNodeIds(selectedNodes.map((n) => n.id));
    },
  });

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  // Send selected nodes to front (end of array = rendered on top)
  const sendToFront = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    setNodes((nds) => {
      const selected = nds.filter((n) => selectedNodeIds.includes(n.id));
      const rest = nds.filter((n) => !selectedNodeIds.includes(n.id));
      // Deselect all nodes after reordering
      return [...rest, ...selected].map((n) => ({ ...n, selected: false }));
    });
  }, [selectedNodeIds, setNodes]);

  // Send selected nodes to back (start of array = rendered behind)
  const sendToBack = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    setNodes((nds) => {
      const selected = nds.filter((n) => selectedNodeIds.includes(n.id));
      const rest = nds.filter((n) => !selectedNodeIds.includes(n.id));
      // Deselect all nodes after reordering
      return [...selected, ...rest].map((n) => ({ ...n, selected: false }));
    });
  }, [selectedNodeIds, setNodes]);

  // Get the color scheme of the first selected node (for display in sidebar)
  const selectedNodeColorScheme: NodeColorScheme | undefined =
    selectedNodeIds.length > 0
      ? ((nodes.find((n) => n.id === selectedNodeIds[0])?.data
          ?.colorScheme as NodeColorScheme) ?? 'default')
      : undefined;

  // Update color scheme for all selected nodes
  const updateSelectedNodesColorScheme = useCallback(
    (colorScheme: NodeColorScheme) => {
      if (selectedNodeIds.length === 0) return;
      setNodes((nds) =>
        nds.map((node) =>
          selectedNodeIds.includes(node.id)
            ? { ...node, data: { ...node.data, colorScheme } }
            : node,
        ),
      );
    },
    [selectedNodeIds, setNodes],
  );

  // Get handles of the first selected node (for display in sidebar)
  const selectedNodeHandles: HandleConfig[] | undefined =
    selectedNodeIds.length > 0
      ? ((nodes.find((n) => n.id === selectedNodeIds[0])?.data
          ?.handles as HandleConfig[]) ?? DEFAULT_HANDLES)
      : undefined;

  // Update handles for all selected nodes
  const updateSelectedNodesHandles = useCallback(
    (handles: HandleConfig[]) => {
      if (selectedNodeIds.length === 0) return;
      setNodes((nds) =>
        nds.map((node) =>
          selectedNodeIds.includes(node.id)
            ? { ...node, data: { ...node.data, handles } }
            : node,
        ),
      );
    },
    [selectedNodeIds, setNodes],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance || !reactFlowWrapper.current) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data:
          type === 'labeled'
            ? { label: 'Label', content: '' }
            : type === 'text'
              ? { content: 'Text' }
              : { content: '' },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  const getExportData = useCallback(() => {
    return { nodes, edges };
  }, [nodes, edges]);

  const handleImport = useCallback(
    (data: { nodes: Node[]; edges: Edge[] }) => {
      setNodes(data.nodes);
      setEdges(data.edges);
      // Update the id counter to avoid conflicts
      const maxId = Math.max(
        0,
        ...data.nodes.map((n) => {
          const match = n.id.match(/node_(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        }),
      );
      id = maxId + 1;
    },
    [setNodes, setEdges],
  );

  return (
    <div className="flex h-screen w-full">
      <style>{`
        .react-flow__edges {
          z-index: 10;
        }
        .react-flow__nodes {
          z-index: 1;
        }
      `}</style>
      <Sidebar
        selectedNodeIds={selectedNodeIds}
        onSendToFront={sendToFront}
        onSendToBack={sendToBack}
        selectedColorScheme={selectedNodeColorScheme}
        onColorSchemeChange={updateSelectedNodesColorScheme}
        selectedHandles={selectedNodeHandles}
        onHandlesChange={updateSelectedNodesHandles}
      />
      <div className="flex-1 flex flex-col bg-neutral-900">
        <div className="flex items-center bg-neutral-900 border-b border-neutral-300">
          <ExportPanel getExportData={getExportData} onImport={handleImport} />
        </div>
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{
              type: 'smoothstep',
              style: { stroke: neutral[300], strokeWidth: 2 },
              markerEnd: {
                type: 'arrowclosed',
              },
            }}
            deleteKeyCode={['Backspace', 'Delete']}
            connectOnClick={true}
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
        </div>
      </div>
    </div>
  );
}

export function DiagramEditor() {
  return (
    <ReactFlowProvider>
      <DiagramEditorInner />
    </ReactFlowProvider>
  );
}
