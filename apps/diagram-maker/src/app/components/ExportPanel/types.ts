import { Node, Edge } from '@xyflow/react';

export type Tab = 'export' | 'import' | 'local-diagrams';

export const isLocal = process.env.NODE_ENV === 'development';

export interface LocalDiagram {
  label: string;
  filePath: string;
  blogPost: string;
  isComplete: boolean;
  data: { nodes: Node[]; edges: Edge[] };
}
