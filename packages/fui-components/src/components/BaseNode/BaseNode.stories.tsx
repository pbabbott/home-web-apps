import { useCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import { DiagramViewer } from '../DiagramViewer/DiagramViewer';
import { DiagramEditor } from '../DiagramEditor/DiagramEditor';
import type { NodeColorScheme } from './BaseNode';
import type { IconRenderer } from '../../types/icons';

const placeholderIcon: IconRenderer = ({ size }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="2" y="2" width="20" height="20" rx="3" fill="#3b82f6" />
    <rect x="7" y="7" width="4" height="4" fill="white" opacity="0.9" />
    <rect x="13" y="7" width="4" height="4" fill="white" opacity="0.9" />
    <rect x="7" y="13" width="4" height="4" fill="white" opacity="0.9" />
    <rect x="13" y="13" width="4" height="4" fill="white" opacity="0.9" />
  </svg>
);

interface StoryProps {
  content: string;
  colorScheme: NodeColorScheme;
  label?: string;
  showLabel: boolean;
}

function SelectedContainer() {
  const [nodes, , onNodesChange] = useNodesState<Node>([
    {
      id: 'node-1',
      type: 'customDefault',
      position: { x: 100, y: 100 },
      data: {
        content: 'Selected node',
        colorScheme: 'primary' as NodeColorScheme,
      },
      selected: true,
    },
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );
  return (
    <ReactFlowProvider>
      <DiagramEditor
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        height="300px"
      />
    </ReactFlowProvider>
  );
}

function StoryContainer({
  content,
  colorScheme,
  label,
  showLabel,
}: StoryProps) {
  return (
    <DiagramViewer
      height="300px"
      data={{
        nodes: [
          {
            id: 'node-1',
            type: showLabel ? 'labeled' : 'customDefault',
            position: { x: 100, y: 100 },
            data: { content, colorScheme, label },
          },
        ],
        edges: [],
      }}
    />
  );
}

const meta: Meta<typeof StoryContainer> = {
  title: 'Diagrams/BaseNode',
  component: StoryContainer,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'diagram' },
    docs: {
      description: {
        component:
          'A customizable node component for React Flow diagrams. Supports editable content, labels, handles, and multiple color schemes. Requires @xyflow/react as a peer dependency.',
      },
    },
  },
  argTypes: {
    content: { control: 'text', description: 'Text content inside the node' },
    colorScheme: {
      control: 'select',
      options: [
        'default',
        'dark',
        'white',
        'primary',
        'secondary',
        'success',
        'error',
        'warning',
        'accent-purple',
        'accent-falcon',
      ],
      description: 'Color scheme',
    },
    label: {
      control: 'text',
      description: 'Label badge text (requires showLabel: true)',
    },
    showLabel: {
      control: 'boolean',
      description: 'Show label badge above node',
    },
  },
};

export default meta;

type Story = StoryObj<typeof StoryContainer>;

export const Default: Story = {
  args: {
    content: 'Default Node',
    colorScheme: 'default',
    showLabel: false,
  },
};

export const WithLabel: Story = {
  args: {
    label: 'My Label',
    content: 'Node with a label badge',
    colorScheme: 'default',
    showLabel: true,
  },
};

export const Primary: Story = {
  args: {
    content: 'Primary color scheme',
    colorScheme: 'primary',
    showLabel: false,
  },
};

export const Secondary: Story = {
  args: {
    content: 'Secondary color scheme',
    colorScheme: 'secondary',
    showLabel: false,
  },
};

export const Dark: Story = {
  args: {
    content: 'Dark color scheme',
    colorScheme: 'dark',
    showLabel: false,
  },
};

export const White: Story = {
  args: {
    content: 'White color scheme',
    colorScheme: 'white',
    showLabel: false,
  },
};

export const Selected: Story = {
  render: () => <SelectedContainer />,
};

export const WithHandles: Story = {
  render: () => (
    <DiagramViewer
      height="300px"
      data={{
        nodes: [
          {
            id: 'node-1',
            type: 'customDefault',
            position: { x: 100, y: 100 },
            data: {
              content: 'Node with handles',
              colorScheme: 'primary',
              handles: [
                { id: 'top-target', type: 'target', position: 'top' },
                { id: 'bottom-source', type: 'source', position: 'bottom' },
              ],
            },
          },
        ],
        edges: [],
      }}
    />
  ),
};

export const LabeledWithHandles: Story = {
  render: () => (
    <DiagramViewer
      height="300px"
      data={{
        nodes: [
          {
            id: 'node-1',
            type: 'labeled',
            position: { x: 100, y: 100 },
            data: {
              label: 'API Service',
              content: 'Handles requests from clients',
              colorScheme: 'secondary',
              handles: [
                { id: 'left-in', type: 'target', position: 'left' },
                { id: 'right-out', type: 'source', position: 'right' },
              ],
            },
          },
        ],
        edges: [],
      }}
    />
  ),
};

export const CustomSize: Story = {
  render: () => (
    <DiagramViewer
      height="300px"
      data={{
        nodes: [
          {
            id: 'node-1',
            type: 'customDefault',
            position: { x: 100, y: 80 },
            data: {
              content: 'Custom sized node (250x120)',
              colorScheme: 'default',
              width: 250,
              height: 120,
            },
          },
        ],
        edges: [],
      }}
    />
  ),
};

export const MultilineContent: Story = {
  render: () => (
    <DiagramViewer
      height="300px"
      data={{
        nodes: [
          {
            id: 'node-1',
            type: 'labeled',
            position: { x: 100, y: 80 },
            data: {
              label: 'Details',
              content: 'Line 1\nLine 2\nLine 3',
              colorScheme: 'primary',
              width: 180,
              height: 100,
            },
          },
        ],
        edges: [],
      }}
    />
  ),
};

export const DefaultWithIcon: Story = {
  render: () => (
    <DiagramViewer
      height="300px"
      renderIcon={placeholderIcon}
      data={{
        nodes: [
          {
            id: 'node-1',
            type: 'customDefault',
            position: { x: 100, y: 100 },
            data: {
              content: 'Node with icon',
              colorScheme: 'primary',
              iconId: 'placeholder',
            },
          },
        ],
        edges: [],
      }}
    />
  ),
};

export const LabeledWithIcon: Story = {
  render: () => (
    <DiagramViewer
      height="300px"
      renderIcon={placeholderIcon}
      data={{
        nodes: [
          {
            id: 'node-1',
            type: 'labeled',
            position: { x: 100, y: 100 },
            data: {
              label: 'Service',
              content: 'Node with icon in label',
              colorScheme: 'secondary',
              iconId: 'placeholder',
            },
          },
        ],
        edges: [],
      }}
    />
  ),
};
