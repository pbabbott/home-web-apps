import { useCallback } from 'react';
import type { Edge } from '@xyflow/react';
import type { EditableEdgeColor } from '@abbottland/fui-components';

interface UseEdgeSelectionControlsArgs {
  edges: Edge[];
  selectedEdgeIds: string[];
  setEdges: (updater: (edges: Edge[]) => Edge[]) => void;
}

export function useEdgeSelectionControls({
  edges,
  selectedEdgeIds,
  setEdges,
}: UseEdgeSelectionControlsArgs) {
  const selectedEdgeType: string | undefined =
    selectedEdgeIds.length > 0
      ? (edges.find((e) => e.id === selectedEdgeIds[0])?.type ?? 'default')
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

  const selectedEdgeLabelColor: EditableEdgeColor | undefined =
    selectedEdgeIds.length > 0
      ? ((edges.find((e) => e.id === selectedEdgeIds[0])?.data
          ?.color as EditableEdgeColor) ?? 'default')
      : undefined;

  const updateSelectedEdgesLabelColor = useCallback(
    (color: EditableEdgeColor) => {
      if (selectedEdgeIds.length === 0) return;
      setEdges((eds) =>
        eds.map((edge) =>
          selectedEdgeIds.includes(edge.id)
            ? { ...edge, data: { ...edge.data, color } }
            : edge,
        ),
      );
    },
    [selectedEdgeIds, setEdges],
  );

  const selectedEdgeActive: boolean | undefined =
    selectedEdgeIds.length > 0
      ? ((edges.find((e) => e.id === selectedEdgeIds[0])?.data
          ?.active as boolean) ?? false)
      : undefined;

  const updateSelectedEdgesActive = useCallback(
    (active: boolean) => {
      if (selectedEdgeIds.length === 0) return;
      setEdges((eds) =>
        eds.map((edge) =>
          selectedEdgeIds.includes(edge.id)
            ? {
                ...edge,
                zIndex: active ? 20 : 0,
                data: { ...edge.data, active },
              }
            : edge,
        ),
      );
    },
    [selectedEdgeIds, setEdges],
  );

  return {
    selectedEdgeType,
    onEdgeTypeChange: updateSelectedEdgesType,
    selectedEdgeLabelColor,
    onEdgeLabelColorChange: updateSelectedEdgesLabelColor,
    selectedEdgeActive,
    onEdgeActiveChange: updateSelectedEdgesActive,
  };
}
