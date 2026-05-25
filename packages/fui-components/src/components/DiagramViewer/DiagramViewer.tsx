'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { EnterFullScreenIcon, ExitFullScreenIcon } from '@radix-ui/react-icons';
import { DefaultEdge } from '../DefaultEdge/DefaultEdge';
import { EditableEdge } from '../EditableEdge/EditableEdge';
import { LabeledNode } from './nodes/LabeledNode';
import { DefaultNode } from './nodes/DefaultNode';
import { TextNode } from './nodes/TextNode';
import { IconRendererProvider } from './IconRendererContext';
import type { IconRenderer } from '../../types/icons';

export interface DiagramViewerProps {
  data: {
    nodes: Node[];
    edges: Edge[];
  };
  height?: string;
  className?: string;
  renderIcon?: IconRenderer;
}

const nodeTypes: NodeTypes = {
  labeled: LabeledNode,
  customDefault: DefaultNode,
  text: TextNode,
};

const edgeTypes: EdgeTypes = {
  editable: EditableEdge,
  default: DefaultEdge,
};

export function DiagramViewer({
  data,
  height = '600px',
  className = '',
  renderIcon,
}: DiagramViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const nodes = useMemo(() => data.nodes, [data.nodes]);
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
        className={`relative w-full rounded-lg overflow-hidden border border-neutral-700 ${className}`}
        style={{ height }}
      >
        <style>{`
        .react-flow__edges {
          z-index: 10;
        }
        .react-flow__nodes {
          z-index: 1;
        }
        :fullscreen .diagram-viewer-inner {
          height: 100%;
        }
      `}</style>
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
          className="absolute top-2 right-2 z-10 p-1.5 rounded bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
        >
          {isFullscreen ? (
            <ExitFullScreenIcon width={16} height={16} />
          ) : (
            <EnterFullScreenIcon width={16} height={16} />
          )}
        </button>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            proOptions={{ hideAttribution: true }}
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
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#374151"
            />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </IconRendererProvider>
  );
}
