'use client';

import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  type DragEvent,
  type RefObject,
} from 'react';
import {
  addEdge,
  useNodesState,
  useEdgesState,
  useOnSelectionChange,
  useUpdateNodeInternals,
  type Connection,
  type Node,
  type Edge,
  type ReactFlowInstance,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';
import {
  warning,
  DEFAULT_HANDLES,
  type NodeColorScheme,
  type HandleConfig,
} from '@abbottland/fui-components';

let id = 0;
const getId = () => `node_${id++}`;

interface DiagramEditorContextValue {
  // Flow data
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (params: Connection) => void;
  onDrop: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
  onInit: (instance: ReactFlowInstance) => void;
  reactFlowWrapper: RefObject<HTMLDivElement | null>;
  // Viewer mode
  viewerMode: boolean;
  onToggleViewerMode: () => void;
  // Export / Import
  getExportData: () => { nodes: Node[]; edges: Edge[] };
  onImport: (data: { nodes: Node[]; edges: Edge[] }) => void;
  // Style
  warningColorRgba: string;
  // Node selection
  selectedNodeIds: string[];
  selectedColorScheme: NodeColorScheme | undefined;
  onColorSchemeChange: (colorScheme: NodeColorScheme) => void;
  selectedHandles: HandleConfig[];
  onHandlesChange: (handles: HandleConfig[]) => void;
  onSendToFront: () => void;
  onSendToBack: () => void;
  // Edge selection
  selectedEdgeIds: string[];
  selectedEdgeType: string | undefined;
  onEdgeTypeChange: (edgeType: string) => void;
  // Node type
  selectedNodeType: string | undefined;
  onNodeTypeChange: (nodeType: string) => void;
}

export const DiagramEditorContext =
  createContext<DiagramEditorContextValue | null>(null);

export function useDiagramEditor(): DiagramEditorContextValue {
  const ctx = useContext(DiagramEditorContext);
  if (!ctx)
    throw new Error(
      'useDiagramEditor must be used within DiagramEditorProvider',
    );
  return ctx;
}

export function DiagramEditorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [viewerMode, setViewerMode] = useState(false);
  const updateNodeInternals = useUpdateNodeInternals();

  useOnSelectionChange({
    onChange: ({ nodes: selectedNodes, edges: selectedEdges }) => {
      setSelectedNodeIds(selectedNodes.map((n) => n.id));
      setSelectedEdgeIds(selectedEdges.map((e) => e.id));
    },
  });

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const sendToFront = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    setNodes((nds) => {
      const selected = nds.filter((n) => selectedNodeIds.includes(n.id));
      const rest = nds.filter((n) => !selectedNodeIds.includes(n.id));
      return [...rest, ...selected].map((n) => ({ ...n, selected: false }));
    });
  }, [selectedNodeIds, setNodes]);

  const sendToBack = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    setNodes((nds) => {
      const selected = nds.filter((n) => selectedNodeIds.includes(n.id));
      const rest = nds.filter((n) => !selectedNodeIds.includes(n.id));
      return [...selected, ...rest].map((n) => ({ ...n, selected: false }));
    });
  }, [selectedNodeIds, setNodes]);

  const selectedNodeColorScheme: NodeColorScheme | undefined =
    selectedNodeIds.length > 0
      ? ((nodes.find((n) => n.id === selectedNodeIds[0])?.data
          ?.colorScheme as NodeColorScheme) ?? 'default')
      : undefined;

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

  const selectedNodeHandles: HandleConfig[] | undefined =
    selectedNodeIds.length > 0
      ? ((nodes.find((n) => n.id === selectedNodeIds[0])?.data
          ?.handles as HandleConfig[]) ?? DEFAULT_HANDLES)
      : undefined;

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
      // setTimeout ensures DOM updates before React Flow processes handle changes
      setTimeout(() => {
        selectedNodeIds.forEach((nodeId) => updateNodeInternals(nodeId));
      }, 0);
    },
    [selectedNodeIds, setNodes, updateNodeInternals],
  );

  const selectedEdgeType: string | undefined =
    selectedEdgeIds.length > 0
      ? (edges.find((e) => e.id === selectedEdgeIds[0])?.type ?? 'editable')
      : undefined;

  const updateSelectedEdgesType = useCallback(
    (edgeType: string) => {
      if (selectedEdgeIds.length === 0) return;
      setEdges((eds) =>
        eds.map((edge) =>
          selectedEdgeIds.includes(edge.id)
            ? { ...edge, type: edgeType }
            : edge,
        ),
      );
    },
    [selectedEdgeIds, setEdges],
  );

  const selectedNodeType: string | undefined =
    selectedNodeIds.length > 0
      ? (nodes.find((n) => n.id === selectedNodeIds[0])?.type ??
        'customDefault')
      : undefined;

  const updateSelectedNodesType = useCallback(
    (nodeType: string) => {
      if (selectedNodeIds.length === 0) return;
      setNodes((nds) =>
        nds.map((node) => {
          if (!selectedNodeIds.includes(node.id)) return node;
          const data = { ...node.data };
          if (nodeType === 'labeled' && !data.label) {
            data.label = (data.content as string) || 'Label';
          }
          return { ...node, type: nodeType, data };
        }),
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
      if (!type || !reactFlowInstance || !reactFlowWrapper.current) return;

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

  const getExportData = useCallback(() => ({ nodes, edges }), [nodes, edges]);

  const handleImport = useCallback(
    (data: { nodes: Node[]; edges: Edge[] }) => {
      setNodes(data.nodes);
      setEdges(data.edges);
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

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  const warningColorRgba = hexToRgba(warning[400], 0.8);

  const value: DiagramEditorContextValue = {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onDrop,
    onDragOver,
    onInit: setReactFlowInstance,
    reactFlowWrapper,
    viewerMode,
    onToggleViewerMode: () => setViewerMode((v) => !v),
    getExportData,
    onImport: handleImport,
    warningColorRgba,
    selectedNodeIds,
    selectedColorScheme: selectedNodeColorScheme,
    onColorSchemeChange: updateSelectedNodesColorScheme,
    selectedHandles: selectedNodeHandles ?? [],
    onHandlesChange: updateSelectedNodesHandles,
    onSendToFront: sendToFront,
    onSendToBack: sendToBack,
    selectedEdgeIds,
    selectedEdgeType,
    onEdgeTypeChange: updateSelectedEdgesType,
    selectedNodeType,
    onNodeTypeChange: updateSelectedNodesType,
  };

  return (
    <DiagramEditorContext.Provider value={value}>
      {children}
    </DiagramEditorContext.Provider>
  );
}
