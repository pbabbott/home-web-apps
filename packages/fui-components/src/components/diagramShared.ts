import type { NodeTypes, EdgeTypes } from '@xyflow/react';
import { DefaultEdge } from './DefaultEdge/DefaultEdge';
import { EditableEdge } from './EditableEdge/EditableEdge';
import { LabeledNode } from './LabeledNode/LabeledNode';
import { DefaultNode } from './DefaultNode/DefaultNode';
import { TextNode } from './TextNode/TextNode';

export const nodeTypes: NodeTypes = {
  labeled: LabeledNode,
  customDefault: DefaultNode,
  text: TextNode,
};

export const edgeTypes: EdgeTypes = {
  editable: EditableEdge,
  default: DefaultEdge,
};

export const diagramContainerClass =
  'relative w-full rounded-lg overflow-hidden border border-neutral-700 bg-neutral-700';

export const diagramProOptions = { hideAttribution: true } as const;

export const diagramFlowStyles = `
  .react-flow__edges {
    z-index: 10;
  }
  .react-flow__nodes {
    z-index: 1;
  }
`;
