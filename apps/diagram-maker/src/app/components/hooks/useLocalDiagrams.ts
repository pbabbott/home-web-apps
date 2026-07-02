import { useCallback, useEffect, useRef, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';

interface UseLocalDiagramsArgs {
  onImport: (data: { nodes: Node[]; edges: Edge[] }) => void;
}

export function useLocalDiagrams({ onImport }: UseLocalDiagramsArgs) {
  const [activeLocalDiagramPath, setActiveLocalDiagramPath] = useState<
    string | null
  >(null);
  const [activeLocalDiagramLabel, setActiveLocalDiagramLabel] = useState<
    string | null
  >(null);
  const [activeLocalDiagramIsComplete, setActiveLocalDiagramIsComplete] =
    useState(false);

  const onLoadLocalDiagram = useCallback(
    (
      filePath: string,
      data: { nodes: Node[]; edges: Edge[] },
      isComplete: boolean,
      label: string,
    ) => {
      onImport(data);
      setActiveLocalDiagramPath(filePath);
      setActiveLocalDiagramIsComplete(isComplete);
      setActiveLocalDiagramLabel(label);
    },
    [onImport],
  );

  const activeLocalDiagramPathRef = useRef(activeLocalDiagramPath);
  useEffect(() => {
    activeLocalDiagramPathRef.current = activeLocalDiagramPath;
  }, [activeLocalDiagramPath]);

  const onToggleActiveLocalDiagramComplete = useCallback(() => {
    setActiveLocalDiagramIsComplete((prev) => {
      const next = !prev;
      const path = activeLocalDiagramPathRef.current;
      if (path) {
        fetch('/api/local-diagrams/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: path, isComplete: next }),
        }).catch(console.error);
      }
      return next;
    });
  }, []);

  return {
    activeLocalDiagramPath,
    activeLocalDiagramLabel,
    activeLocalDiagramIsComplete,
    onLoadLocalDiagram,
    onToggleActiveLocalDiagramComplete,
  };
}
