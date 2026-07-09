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
  /** false = suppress the active-edge spark effect (e.g. reduced-motion mode) */
  animated?: boolean;
}

// iOS Safari never implements the standard Fullscreen API for arbitrary
// elements (iPhone Safari doesn't expose it at all; older iPad Safari needs
// the webkit-prefixed variants). These types + helpers cover both prefixed
// APIs so we can detect support and fall back when there is none.
interface FullscreenDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
}

interface FullscreenElement extends HTMLDivElement {
  webkitRequestFullscreen?: () => Promise<void>;
}

function nativeFullscreenSupported(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled);
}

function getFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
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
  animated = true,
}: DiagramViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // WORKAROUND: on browsers with no usable Fullscreen API (iPhone Safari,
  // always; older iPad Safari, sometimes) we fake it with a fixed-position
  // overlay instead. This is a stopgap, not real fullscreen — no browser
  // chrome is hidden and there's no native fullscreenchange event backing
  // it. Revisit if Safari improves support or a better approach shows up.
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);

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
        data: {
          ...edge.data,
          readonly: true,
          active: animated ? edge.data?.active : false,
        },
      })),
    [data.edges, animated],
  );

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(getFullscreenElement() === containerRef.current);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener(
        'webkitfullscreenchange',
        onFullscreenChange,
      );
    };
  }, []);

  // WORKAROUND: body scroll lock for the pseudo-fullscreen fallback above,
  // since there's no real fullscreen mode holding the layout for us.
  useEffect(() => {
    if (!isPseudoFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isPseudoFullscreen]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current as FullscreenElement | null;
    if (!container) return;

    if (!nativeFullscreenSupported()) {
      setIsPseudoFullscreen((prev) => !prev);
      return;
    }

    if (getFullscreenElement()) {
      const doc = document as FullscreenDocument;
      void (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    } else {
      void (
        container.requestFullscreen?.() ?? container.webkitRequestFullscreen?.()
      );
    }
  }, []);

  return (
    <IconRendererProvider renderer={renderIcon}>
      <div
        ref={containerRef}
        className={extendedTwMerge(
          diagramContainerClass,
          // WORKAROUND: fake fullscreen via fixed positioning, see
          // isPseudoFullscreen above.
          isPseudoFullscreen &&
            'diagram-viewer-pseudo-fullscreen fixed inset-0 z-50',
          className,
        )}
        style={isPseudoFullscreen ? undefined : { height }}
      >
        <style>{`${diagramFlowStyles}
        :fullscreen .diagram-viewer-inner,
        .diagram-viewer-pseudo-fullscreen .diagram-viewer-inner {
          height: 100%;
        }
      `}</style>
        <ReactFlowProvider>
          <DiagramViewerInner
            nodes={nodes}
            edges={edges}
            isFullscreen={isFullscreen || isPseudoFullscreen}
            toggleFullscreen={toggleFullscreen}
            showMinimap={showMinimap}
          />
        </ReactFlowProvider>
      </div>
    </IconRendererProvider>
  );
}
