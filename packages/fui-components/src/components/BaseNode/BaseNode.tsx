'use client';

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import {
  Handle,
  Position,
  type NodeProps,
  useReactFlow,
  type Node,
  NodeResizer,
} from '@xyflow/react';

import { Typography } from '../Typography/Typography';
import {
  DEFAULT_HANDLES,
  MIN_WIDTH,
  MIN_HEIGHT,
  type HandleConfig,
  type HandlePosition,
} from './BaseNode.constants';

export type NodeColorScheme = 'primary' | 'secondary' | 'default';

export interface BaseNodeData extends Record<string, unknown> {
  label?: string;
  content?: string;
  width?: number;
  height?: number;
  colorScheme?: NodeColorScheme;
  handles?: HandleConfig[];
}

export type BaseNodeType = Node<BaseNodeData>;

// Map HandlePosition to React Flow Position
const positionMap: Record<HandlePosition, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

// Color scheme styles mapping
const colorSchemeStyles: Record<
  NodeColorScheme,
  { bg: string; border: string; labelBg: string; text: string }
> = {
  primary: {
    bg: 'bg-neutral-900',
    border: 'border-primary-600',
    labelBg: 'bg-neutral-900',
    text: 'text-primary-200',
  },
  secondary: {
    bg: 'bg-neutral-900',
    border: 'border-secondary-600',
    labelBg: 'bg-neutral-900',
    text: 'text-secondary-200',
  },
  default: {
    bg: 'bg-neutral-800',
    border: 'border-neutral-600',
    labelBg: 'bg-neutral-700',
    text: 'text-neutral-200',
  },
};

export interface BaseNodeProps {
  id: string;
  data: BaseNodeData;
  selected?: boolean;
  showLabel?: boolean;
  children?: ReactNode;
}

export function BaseNode({
  id,
  data,
  selected,
  showLabel = false,
}: BaseNodeProps) {
  const { setNodes } = useReactFlow();
  const colorScheme = data.colorScheme ?? 'default';
  const colors = colorSchemeStyles[colorScheme];
  const handles = data.handles ?? DEFAULT_HANDLES;

  // Label editing state (only used if showLabel is true)
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(data.label ?? 'Label');
  const labelInputRef = useRef<HTMLTextAreaElement>(null);

  // Content editing state
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [contentValue, setContentValue] = useState(data.content ?? '');
  const contentInputRef = useRef<HTMLTextAreaElement>(null);

  // Focus label input when editing
  useEffect(() => {
    if (isEditingLabel && labelInputRef.current) {
      labelInputRef.current.focus();
      labelInputRef.current.select();
    }
  }, [isEditingLabel]);

  // Auto-resize label textarea
  useEffect(() => {
    if (isEditingLabel && labelInputRef.current) {
      labelInputRef.current.style.height = 'auto';
      labelInputRef.current.style.height = `${labelInputRef.current.scrollHeight}px`;
    }
  }, [isEditingLabel, labelValue]);

  // Focus content input when editing
  useEffect(() => {
    if (isEditingContent && contentInputRef.current) {
      contentInputRef.current.focus();
      contentInputRef.current.select();
    }
  }, [isEditingContent]);

  // Label handlers
  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingLabel(true);
  }, []);

  const handleLabelBlur = useCallback(() => {
    setIsEditingLabel(false);
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, label: labelValue } }
          : node,
      ),
    );
  }, [id, labelValue, setNodes]);

  const handleLabelKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Allow Enter for new lines, use Cmd/Ctrl+Enter to save
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleLabelBlur();
      }
      if (e.key === 'Escape') {
        setLabelValue(data.label ?? 'Label');
        setIsEditingLabel(false);
      }
    },
    [handleLabelBlur, data.label],
  );

  // Content handlers
  const handleContentDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingContent(true);
  }, []);

  const handleContentBlur = useCallback(() => {
    setIsEditingContent(false);
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, content: contentValue } }
          : node,
      ),
    );
  }, [id, contentValue, setNodes]);

  const handleContentKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Allow Enter for new lines, use Cmd/Ctrl+Enter to save
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleContentBlur();
      }
      if (e.key === 'Escape') {
        setContentValue(data.content ?? '');
        setIsEditingContent(false);
      }
    },
    [handleContentBlur, data.content],
  );

  const onResize = useCallback(
    (_: unknown, params: { width: number; height: number }) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  width: params.width,
                  height: params.height,
                },
              }
            : node,
        ),
      );
    },
    [id, setNodes],
  );

  const borderClasses = `border-2 ${colors.border}`;

  return (
    <div
      className={`
        ${colors.bg}
        ${selected ? 'border-primary-500 shadow-lg shadow-primary-500/20' : borderClasses}
        transition-colors duration-150
        relative
        cursor-pointer
      `}
      style={{
        width: data.width ?? MIN_WIDTH,
        height: data.height ?? MIN_HEIGHT,
        pointerEvents: 'auto',
        opacity: selected ? 0.5 : 1,
      }}
    >
      {/* Resizer - only visible when selected */}
      <NodeResizer
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        isVisible={selected}
        onResize={onResize}
        lineClassName="!border-primary-500"
        handleClassName="!w-2.5 !h-2.5 !bg-primary-500 !border-2 !border-secondary-800 !rounded-sm"
      />

      {/* Label in top-left - only shown if showLabel is true */}
      {showLabel && (
        <div
          className={`absolute -top-3 left-2 px-2 py-0.5 ${colors.labelBg} ${borderClasses} text-xs font-medium z-10`}
          onDoubleClick={handleLabelDoubleClick}
        >
          {isEditingLabel ? (
            <textarea
              ref={labelInputRef}
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              onBlur={handleLabelBlur}
              onKeyDown={handleLabelKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="bg-secondary-900 text-white px-1 py-0.5 outline-none border border-primary-500 min-w-[60px] resize-none text-xs font-medium"
              rows={1}
              style={{ minHeight: '1.5rem' }}
            />
          ) : (
            <Typography
              variant="body2"
              component="span"
              className={`cursor-text ${colors.text} whitespace-pre-wrap`}
            >
              {labelValue}
            </Typography>
          )}
        </div>
      )}

      {/* Node content area - double-click to edit */}
      <div
        className={`h-full flex items-center ${showLabel ? 'justify-start' : 'justify-center'} overflow-hidden ${showLabel ? 'p-3 pt-5' : 'p-3'}`}
        onDoubleClick={!isEditingContent ? handleContentDoubleClick : undefined}
        style={{
          pointerEvents: isEditingContent ? 'auto' : 'none',
        }}
      >
        {isEditingContent ? (
          <textarea
            ref={contentInputRef}
            value={contentValue}
            onChange={(e) => setContentValue(e.target.value)}
            onBlur={handleContentBlur}
            onKeyDown={handleContentKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full h-full bg-secondary-900 text-white p-2 outline-none border border-primary-500 resize-none text-sm pointer-events-auto"
            placeholder="Enter text..."
          />
        ) : contentValue ? (
          <Typography
            variant="body2"
            component="span"
            className={`${colors.text} ${showLabel ? 'text-left' : 'text-center'} whitespace-pre-wrap cursor-text pointer-events-auto`}
            onDoubleClick={handleContentDoubleClick}
          >
            {contentValue}
          </Typography>
        ) : (
          <div
            className="w-full h-full pointer-events-auto"
            onDoubleClick={handleContentDoubleClick}
          />
        )}
      </div>

      {/* Dynamic Handles */}
      {handles.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type={handle.type}
          position={positionMap[handle.position]}
          isConnectable={true}
          className="!w-3 !h-3 !bg-primary-500 !border-2 !border-secondary-800 hover:!bg-primary-400 hover:scale-125 transition-transform cursor-crosshair !pointer-events-auto !z-50"
        />
      ))}
    </div>
  );
}

// Re-export for convenience
export type { NodeProps };
