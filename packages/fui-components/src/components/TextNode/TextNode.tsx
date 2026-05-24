'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { type NodeProps, useReactFlow, type Node } from '@xyflow/react';
import { Typography } from '../Typography/Typography';
import { type NodeColorScheme } from '../BaseNode/BaseNode';

export interface TextNodeData extends Record<string, unknown> {
  content?: string;
  colorScheme?: NodeColorScheme;
}

type TextNodeType = Node<TextNodeData, 'text'>;

const textColorStyles: Record<NodeColorScheme, string> = {
  primary: 'text-primary-300',
  secondary: 'text-secondary-100',
  default: 'text-neutral-200',
};

export function TextNode({ id, data, selected }: NodeProps<TextNodeType>) {
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [contentValue, setContentValue] = useState(data.content ?? 'Text');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const colorScheme = data.colorScheme ?? 'default';
  const textColor = textColorStyles[colorScheme];

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, content: contentValue } }
          : node,
      ),
    );
  }, [id, contentValue, setNodes]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleBlur();
      }
      if (e.key === 'Escape') {
        setContentValue(data.content ?? 'Text');
        setIsEditing(false);
      }
    },
    [handleBlur, data.content],
  );

  return (
    <div
      className={`
        min-w-[50px] min-h-[24px] px-1
        ${selected ? 'outline outline-2 outline-primary-500 outline-offset-2 rounded' : ''}
      `}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <textarea
          ref={inputRef}
          value={contentValue}
          onChange={(e) => setContentValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="bg-secondary-900 text-white p-2 outline-none border border-primary-500 resize-none text-sm min-w-[100px] min-h-[60px]"
          placeholder="Enter text..."
        />
      ) : (
        <Typography
          variant="body1"
          component="span"
          className={`whitespace-pre-wrap cursor-text ${textColor}`}
        >
          {contentValue}
        </Typography>
      )}
    </div>
  );
}
