import { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import {
  DEFAULT_HANDLES,
  MIN_WIDTH,
  MIN_HEIGHT,
  type NodeColorScheme,
  type HandleConfig,
} from '@abbottland/fui-components';

export type NodeAlignment =
  | 'left'
  | 'center-h'
  | 'right'
  | 'top'
  | 'center-v'
  | 'bottom';

interface UseNodeSelectionControlsArgs {
  nodes: Node[];
  selectedNodeIds: string[];
  setNodes: (updater: (nodes: Node[]) => Node[]) => void;
}

export function useNodeSelectionControls({
  nodes,
  selectedNodeIds,
  setNodes,
}: UseNodeSelectionControlsArgs) {
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

  const alignSelectedNodes = useCallback(
    (alignment: NodeAlignment) => {
      if (selectedNodeIds.length < 2) return;
      setNodes((nds) => {
        const getWidth = (n: Node) =>
          n.measured?.width ??
          (n.data?.width as number | undefined) ??
          MIN_WIDTH;
        const getHeight = (n: Node) =>
          n.measured?.height ??
          (n.data?.height as number | undefined) ??
          MIN_HEIGHT;

        const selected = nds.filter((n) => selectedNodeIds.includes(n.id));
        const minX = Math.min(...selected.map((n) => n.position.x));
        const maxX = Math.max(
          ...selected.map((n) => n.position.x + getWidth(n)),
        );
        const minY = Math.min(...selected.map((n) => n.position.y));
        const maxY = Math.max(
          ...selected.map((n) => n.position.y + getHeight(n)),
        );

        return nds.map((n) => {
          if (!selectedNodeIds.includes(n.id)) return n;
          const w = getWidth(n);
          const h = getHeight(n);
          switch (alignment) {
            case 'left':
              return { ...n, position: { ...n.position, x: minX } };
            case 'right':
              return { ...n, position: { ...n.position, x: maxX - w } };
            case 'center-h':
              return {
                ...n,
                position: { ...n.position, x: (minX + maxX) / 2 - w / 2 },
              };
            case 'top':
              return { ...n, position: { ...n.position, y: minY } };
            case 'bottom':
              return { ...n, position: { ...n.position, y: maxY - h } };
            case 'center-v':
              return {
                ...n,
                position: { ...n.position, y: (minY + maxY) / 2 - h / 2 },
              };
          }
        });
      });
    },
    [selectedNodeIds, setNodes],
  );

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

  const selectedTransparentBackground: boolean | undefined =
    selectedNodeIds.length > 0
      ? ((nodes.find((n) => n.id === selectedNodeIds[0])?.data
          ?.transparentBackground as boolean) ?? false)
      : undefined;

  const updateSelectedNodesTransparentBackground = useCallback(
    (transparentBackground: boolean) => {
      if (selectedNodeIds.length === 0) return;
      setNodes((nds) =>
        nds.map((node) =>
          selectedNodeIds.includes(node.id)
            ? { ...node, data: { ...node.data, transparentBackground } }
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
    },
    [selectedNodeIds, setNodes],
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

  const selectedNodeIconId: string | undefined =
    selectedNodeIds.length > 0
      ? (nodes.find((n) => n.id === selectedNodeIds[0])?.data?.iconId as
          | string
          | undefined)
      : undefined;

  const updateSelectedNodesIconId = useCallback(
    (iconId: string | undefined) => {
      if (selectedNodeIds.length === 0) return;
      setNodes((nds) =>
        nds.map((node) => {
          if (!selectedNodeIds.includes(node.id)) return node;
          const data = { ...node.data };
          if (iconId === undefined) {
            delete data.iconId;
          } else {
            data.iconId = iconId;
          }
          return { ...node, data };
        }),
      );
    },
    [selectedNodeIds, setNodes],
  );

  return {
    selectedColorScheme: selectedNodeColorScheme,
    onColorSchemeChange: updateSelectedNodesColorScheme,
    selectedTransparentBackground,
    onTransparentBackgroundChange: updateSelectedNodesTransparentBackground,
    selectedHandles: selectedNodeHandles ?? [],
    onHandlesChange: updateSelectedNodesHandles,
    onSendToFront: sendToFront,
    onSendToBack: sendToBack,
    onAlignNodes: alignSelectedNodes,
    selectedNodeType,
    onNodeTypeChange: updateSelectedNodesType,
    selectedIconId: selectedNodeIconId,
    onIconChange: updateSelectedNodesIconId,
  };
}
