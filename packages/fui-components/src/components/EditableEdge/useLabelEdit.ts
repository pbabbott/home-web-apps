import { useState, useCallback, useRef, useEffect } from 'react';
import { useReactFlow, type EdgeProps } from '@xyflow/react';

interface UseLabelEditOptions {
  id: string;
  data: EdgeProps['data'];
  isReadonly?: boolean;
}

export function useLabelEdit({ id, data, isReadonly }: UseLabelEditOptions) {
  const { setEdges } = useReactFlow();
  const originalLabel = typeof data?.label === 'string' ? data.label : '';

  const [isEditing, setIsEditing] = useState(false);
  const [labelValue, setLabelValue] = useState<string>(originalLabel);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isReadonly) setIsEditing(true);
    },
    [isReadonly],
  );

  const commitLabel = useCallback(() => {
    setIsEditing(false);
    setEdges((edges) =>
      edges.map((edge) =>
        edge.id === id
          ? { ...edge, data: { ...edge.data, label: labelValue } }
          : edge,
      ),
    );
  }, [id, labelValue, setEdges]);

  const cancelEditing = useCallback(() => {
    setLabelValue(originalLabel);
    setIsEditing(false);
  }, [originalLabel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        commitLabel();
      }
      if (e.key === 'Escape') {
        cancelEditing();
      }
    },
    [commitLabel, cancelEditing],
  );

  return {
    isEditing,
    labelValue,
    setLabelValue,
    inputRef,
    startEditing,
    commitLabel,
    handleKeyDown,
  };
}
