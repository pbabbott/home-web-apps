import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Edge, Node } from '@xyflow/react';
import { DiagramViewer } from '../DiagramViewer/DiagramViewer';

const nodes: Node[] = [
  {
    id: 'node-1',
    type: 'customDefault',
    position: { x: 100, y: 150 },
    data: {
      content: 'Node 1',
      colorScheme: 'primary',
      handles: [{ id: 'right-source', type: 'source', position: 'right' }],
    },
  },
  {
    id: 'node-2',
    type: 'customDefault',
    position: { x: 400, y: 150 },
    data: {
      content: 'Node 2',
      colorScheme: 'secondary',
      handles: [{ id: 'left-target', type: 'target', position: 'left' }],
    },
  },
];

const edges: Edge[] = [
  {
    id: 'edge-1-2',
    source: 'node-1',
    target: 'node-2',
    sourceHandle: 'right-source',
    targetHandle: 'left-target',
    type: 'default',
  },
];

function StoryContainer() {
  return <DiagramViewer height="400px" data={{ nodes, edges }} />;
}

const meta: Meta<typeof StoryContainer> = {
  title: 'Diagrams/DefaultEdge',
  component: StoryContainer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A simple smooth-step edge for React Flow diagrams. No label or color options — use EditableEdge for interactive edges.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof StoryContainer>;

export const Default: Story = {};
