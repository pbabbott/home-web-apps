import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReactFlow, ReactFlowProvider, type NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { neutral } from '../../tokens/colors';
import { TextNode, type TextNodeData } from './TextNode';
import type { NodeColorScheme } from '../BaseNode/BaseNode';
import { IconRendererProvider } from '../DiagramViewer/IconRendererContext';
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
  selected: boolean;
  readonly: boolean;
}

const nodeTypes: NodeTypes = { text: TextNode };

function StoryContainer({
  content,
  colorScheme,
  selected,
  readonly,
}: StoryProps) {
  const data: TextNodeData = { content, colorScheme, readonly };
  return (
    <ReactFlowProvider>
      <div style={{ width: '100%', height: '300px', background: neutral[900] }}>
        <ReactFlow
          nodes={[
            {
              id: 'node-1',
              type: 'text',
              position: { x: 150, y: 120 },
              data,
              selected,
            },
          ]}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 1 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        />
      </div>
    </ReactFlowProvider>
  );
}

function StoryContainerWithIcon({
  content,
  colorScheme,
  selected,
  readonly,
}: StoryProps) {
  const data: TextNodeData = { content, colorScheme, readonly, iconId: 'placeholder' };
  return (
    <ReactFlowProvider>
      <IconRendererProvider renderer={placeholderIcon}>
        <div style={{ width: '100%', height: '300px', background: neutral[900] }}>
          <ReactFlow
            nodes={[
              {
                id: 'node-1',
                type: 'text',
                position: { x: 150, y: 120 },
                data,
                selected,
              },
            ]}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 1 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
          />
        </div>
      </IconRendererProvider>
    </ReactFlowProvider>
  );
}

const meta: Meta<typeof StoryContainer> = {
  title: 'Diagrams/TextNode',
  component: StoryContainer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A borderless text node for React Flow diagrams. No box or handles — use for labels, annotations, or free-floating text. Double-click to edit (unless readonly).',
      },
    },
  },
  argTypes: {
    content: { control: 'text', description: 'Text content of the node' },
    colorScheme: {
      control: 'select',
      options: ['default', 'primary', 'secondary'],
      description: 'Text color scheme',
    },
    selected: {
      control: 'boolean',
      description: 'Whether the node is selected (shows outline)',
    },
    readonly: {
      control: 'boolean',
      description: 'Disables double-click editing',
    },
  },
};

export default meta;

type Story = StoryObj<typeof StoryContainer>;

export const Default: Story = {
  args: {
    content: 'Text Node',
    colorScheme: 'default',
    selected: false,
    readonly: false,
  },
};

export const Primary: Story = {
  args: {
    content: 'Primary text',
    colorScheme: 'primary',
    selected: false,
    readonly: false,
  },
};

export const Secondary: Story = {
  args: {
    content: 'Secondary text',
    colorScheme: 'secondary',
    selected: false,
    readonly: false,
  },
};

export const Selected: Story = {
  args: {
    content: 'Selected node',
    colorScheme: 'default',
    selected: true,
    readonly: false,
  },
};

export const Readonly: Story = {
  args: {
    content: 'Read-only (double-click disabled)',
    colorScheme: 'default',
    selected: false,
    readonly: true,
  },
};

export const Multiline: Story = {
  args: {
    content: 'Line 1\nLine 2\nLine 3',
    colorScheme: 'primary',
    selected: false,
    readonly: false,
  },
};

type IconStory = StoryObj<typeof StoryContainerWithIcon>;

export const WithIcon: IconStory = {
  render: (args) => <StoryContainerWithIcon {...args} />,
  args: {
    content: 'Text with icon',
    colorScheme: 'default',
    selected: false,
    readonly: false,
  },
};
