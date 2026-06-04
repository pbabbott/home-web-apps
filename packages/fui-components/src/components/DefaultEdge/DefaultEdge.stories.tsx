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

function makeEdge(active: boolean): Edge {
  return {
    id: 'edge-1-2',
    source: 'node-1',
    target: 'node-2',
    sourceHandle: 'right-source',
    targetHandle: 'left-target',
    type: 'default',
    data: { active },
    // Elevate above other edges so the spark paints on top when edges overlap.
    zIndex: active ? 20 : 0,
  };
}

function StoryContainer({ active = false }: { active?: boolean }) {
  return (
    <DiagramViewer height="400px" data={{ nodes, edges: [makeEdge(active)] }} />
  );
}

const meta: Meta<typeof StoryContainer> = {
  title: 'Diagrams/DefaultEdge',
  component: StoryContainer,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'diagram' },
    docs: {
      description: {
        component:
          'A simple smooth-step edge for React Flow diagrams. Pass `data.active = true` to enable the animated spark effect.',
      },
    },
  },
  argTypes: {
    active: { control: 'boolean', description: 'Enable spark animation' },
  },
};

export default meta;

type Story = StoryObj<typeof StoryContainer>;

export const Default: Story = {
  args: { active: false },
};

export const Active: Story = {
  args: { active: true },
};
