'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import { neutral, withOpacity } from '../../tokens/colors';
import { DiagramControls } from '../DiagramControls/DiagramControls';
import { DiagramMinimap } from '../DiagramMinimap/DiagramMinimap';
import { IconRendererProvider } from './IconRendererContext';
import type { IconRenderer } from '../../types/icons';
import {
  nodeTypes,
  edgeTypes,
  diagramContainerClass,
  diagramFlowStyles,
  diagramProOptions,
} from '../diagramShared';

export interface DiagramViewerProps {
  data: {
    nodes: Node[];
    edges: Edge[];
  };
  height?: string;
  className?: string;
  renderIcon?: IconRenderer;
  showMinimap?: boolean;
}

interface DiagramViewerInnerProps {
  nodes: Node[];
  edges: Edge[];
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  showMinimap: boolean;
}

function DiagramViewerInner({
  nodes,
  edges,
  isFullscreen,
  toggleFullscreen,
  showMinimap,
}: DiagramViewerInnerProps) {
  return (
    <>
      <DiagramControls
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={diagramProOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        className="diagram-viewer-inner h-full"
      >
        <Background
          variant={BackgroundVariant.Lines}
          gap={20}
          size={2}
          color={withOpacity(neutral[800], 0.5)}
        />
        {showMinimap && <DiagramMinimap />}
      </ReactFlow>
    </>
  );
}

export function DiagramViewer({
  data,
  height = '600px',
  className = '',
  renderIcon,
  showMinimap = false,
}: DiagramViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const nodes = useMemo(
    () =>
      data.nodes.map((node) => ({
        ...node,
        data: { ...node.data, readonly: true },
      })),
    [data.nodes],
  );
  const edges = useMemo(
    () =>
      data.edges.map((edge) => ({
        ...edge,
        data: { ...edge.data, readonly: true },
      })),
    [data.edges],
  );

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current.requestFullscreen();
    }
  }, []);

  return (
    <IconRendererProvider renderer={renderIcon}>
      <div
        ref={containerRef}
        className={extendedTwMerge(diagramContainerClass, className)}
        style={{ height }}
      >
        <style>{`${diagramFlowStyles}
        :fullscreen .diagram-viewer-inner {
          height: 100%;
        }
      `}</style>
        <ReactFlowProvider>
          <DiagramViewerInner
            nodes={nodes}
            edges={edges}
            isFullscreen={isFullscreen}
            toggleFullscreen={toggleFullscreen}
            showMinimap={showMinimap}
          />
        </ReactFlowProvider>
      </div>
    </IconRendererProvider>
  );
}
