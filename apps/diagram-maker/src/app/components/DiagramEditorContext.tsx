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
  type Connection,
  type Node,
  type Edge,
  type ReactFlowInstance,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';
import {
  warning,
  type NodeColorScheme,
  type HandleConfig,
  type EditableEdgeColor,
} from '@abbottland/fui-components';
import {
  useNodeSelectionControls,
  type NodeAlignment,
} from './hooks/useNodeSelectionControls';
import { useEdgeSelectionControls } from './hooks/useEdgeSelectionControls';
import { useLocalDiagrams } from './hooks/useLocalDiagrams';

export type { NodeAlignment } from './hooks/useNodeSelectionControls';

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
  addNodeAtScreenPosition: (type: string, x: number, y: number) => void;
  onInit: (instance: ReactFlowInstance) => void;
  reactFlowWrapper: RefObject<HTMLDivElement | null>;
  // Viewer mode
  viewerMode: boolean;
  onToggleViewerMode: () => void;
  // Export / Import
  getExportData: () => { nodes: Node[]; edges: Edge[] };
  onImport: (data: { nodes: Node[]; edges: Edge[] }) => void;
  // Local diagrams (dev only)
  activeLocalDiagramPath: string | null;
  activeLocalDiagramLabel: string | null;
  activeLocalDiagramIsComplete: boolean;
  onLoadLocalDiagram: (
    filePath: string,
    data: { nodes: Node[]; edges: Edge[] },
    isComplete: boolean,
    label: string,
  ) => void;
  onToggleActiveLocalDiagramComplete: () => void;
  // Style
  warningColorRgba: string;
  // Node selection
  selectedNodeIds: string[];
  selectedColorScheme: NodeColorScheme | undefined;
  onColorSchemeChange: (colorScheme: NodeColorScheme) => void;
  selectedTransparentBackground: boolean | undefined;
  onTransparentBackgroundChange: (transparentBackground: boolean) => void;
  selectedHandles: HandleConfig[];
  onHandlesChange: (handles: HandleConfig[]) => void;
  onSendToFront: () => void;
  onSendToBack: () => void;
  onAlignNodes: (alignment: NodeAlignment) => void;
  // Edge selection
  selectedEdgeIds: string[];
  selectedEdgeType: string | undefined;
  onEdgeTypeChange: (edgeType: string) => void;
  selectedEdgeLabelColor: EditableEdgeColor | undefined;
  onEdgeLabelColorChange: (color: EditableEdgeColor) => void;
  selectedEdgeActive: boolean | undefined;
  onEdgeActiveChange: (active: boolean) => void;
  // Node type
  selectedNodeType: string | undefined;
  onNodeTypeChange: (nodeType: string) => void;
  // Icon
  selectedIconId: string | undefined;
  onIconChange: (iconId: string | undefined) => void;
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
  const [viewerMode, setViewerMode] = useState(false);
  const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id);
  const selectedEdgeIds = edges.filter((e) => e.selected).map((e) => e.id);

  const nodeSelectionControls = useNodeSelectionControls({
    nodes,
    selectedNodeIds,
    setNodes,
    setEdges,
  });
  const edgeSelectionControls = useEdgeSelectionControls({
    edges,
    selectedEdgeIds,
    setEdges,
  });

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
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

  const addNodeAtScreenPosition = useCallback(
    (type: string, x: number, y: number) => {
      if (!reactFlowInstance || !reactFlowWrapper.current) return;
      const rect = reactFlowWrapper.current.getBoundingClientRect();
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom)
        return;
      const position = reactFlowInstance.screenToFlowPosition({ x, y });
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

  const localDiagrams = useLocalDiagrams({ onImport: handleImport });

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
    addNodeAtScreenPosition,
    onInit: setReactFlowInstance,
    reactFlowWrapper,
    viewerMode,
    onToggleViewerMode: () => setViewerMode((v) => !v),
    getExportData,
    onImport: handleImport,
    ...localDiagrams,
    warningColorRgba,
    selectedNodeIds,
    ...nodeSelectionControls,
    selectedEdgeIds,
    ...edgeSelectionControls,
  };

  return (
    <DiagramEditorContext.Provider value={value}>
      {children}
    </DiagramEditorContext.Provider>
  );
}
