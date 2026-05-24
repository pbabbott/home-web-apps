'use client';

import { ReactFlowProvider } from '@xyflow/react';
import { DiagramViewer } from '@abbottland/fui-components';
import {
  DiagramEditorProvider,
  useDiagramEditor,
} from './DiagramEditorContext';
import { DiagramEditor } from './DiagramEditor';
import { Sidebar } from './Sidebar/Sidebar';
import { Header } from './Header';

function DiagramEditorLayout() {
  const { nodes, edges, reactFlowWrapper, viewerMode, warningColorRgba } =
    useDiagramEditor();

  return (
    <div className="flex h-screen w-full">
      <style>{`
        .react-flow__edges {
          z-index: 10;
        }
        .react-flow__nodes {
          z-index: 1;
        }
        .react-flow__edge.selected {
          filter: drop-shadow(0 0 4px ${warningColorRgba});
        }
      `}</style>
      <Sidebar />
      <div className="flex-1 flex flex-col bg-neutral-900">
        <Header />
        <div className="flex-1" ref={reactFlowWrapper}>
          {viewerMode ? (
            <DiagramViewer
              data={{ nodes, edges }}
              height="100%"
              className="!rounded-none !border-none"
            />
          ) : (
            <DiagramEditor />
          )}
        </div>
      </div>
    </div>
  );
}

export function DiagramEditorClient() {
  return (
    <ReactFlowProvider>
      <DiagramEditorProvider>
        <DiagramEditorLayout />
      </DiagramEditorProvider>
    </ReactFlowProvider>
  );
}
