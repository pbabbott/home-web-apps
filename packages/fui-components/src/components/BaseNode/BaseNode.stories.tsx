import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReactFlow, ReactFlowProvider, type NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { neutral } from '../../tokens/colors';
import { BaseNode, type BaseNodeProps, type BaseNodeData } from './BaseNode';

// Wrapper component that renders BaseNode inside a minimal ReactFlow canvas
function BaseNodeStoryWrapper(
  props: Omit<BaseNodeProps, 'id'> & { id?: string },
) {
  const { id = 'story-node', data, selected, showLabel } = props;

  // Create a custom node component that passes through to BaseNode
  const CustomNode = ({
    id: nodeId,
    data: nodeData,
    selected: nodeSelected,
  }: {
    id: string;
    data: BaseNodeData;
    selected?: boolean;
  }) => (
    <BaseNode
      id={nodeId}
      data={nodeData}
      selected={nodeSelected}
      showLabel={showLabel}
    />
  );

  const nodeTypes: NodeTypes = {
    baseNode: CustomNode,
  };

  const nodes = [
    {
      id,
      type: 'baseNode',
      position: { x: 50, y: 50 },
      data,
      selected,
    },
  ];

  return (
    <div style={{ width: '100%', height: '400px', background: neutral[900] }}>
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.5 }}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        proOptions={{ hideAttribution: true }}
      />
    </div>
  );
}

// Wrap the story wrapper with ReactFlowProvider
function StoryContainer(props: Omit<BaseNodeProps, 'id'> & { id?: string }) {
  return (
    <ReactFlowProvider>
      <BaseNodeStoryWrapper {...props} />
    </ReactFlowProvider>
  );
}

const meta: Meta<typeof StoryContainer> = {
  title: 'Diagrams/BaseNode',
  component: StoryContainer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A customizable node component for React Flow diagrams. Supports editable content, labels, handles, and multiple color schemes. Requires @xyflow/react as a peer dependency.',
      },
    },
  },
  argTypes: {
    showLabel: {
      control: 'boolean',
      description: 'Whether to show the label badge above the node',
    },
    selected: {
      control: 'boolean',
      description: 'Whether the node is selected',
    },
    data: {
      description:
        'Node data including content, label, dimensions, and color scheme',
    },
  },
};

export default meta;

type Story = StoryObj<typeof StoryContainer>;

export const Default: Story = {
  args: {
    data: {
      content: 'Default Node',
      colorScheme: 'default',
    },
    showLabel: false,
    selected: false,
  },
};

export const WithLabel: Story = {
  args: {
    data: {
      label: 'My Label',
      content: 'Node with a label badge',
      colorScheme: 'default',
    },
    showLabel: true,
    selected: false,
  },
};

export const Primary: Story = {
  args: {
    data: {
      content: 'Primary color scheme',
      colorScheme: 'primary',
    },
    showLabel: false,
    selected: false,
  },
};

export const Secondary: Story = {
  args: {
    data: {
      content: 'Secondary color scheme',
      colorScheme: 'secondary',
    },
    showLabel: false,
    selected: false,
  },
};

export const Selected: Story = {
  args: {
    data: {
      content: 'Selected node',
      colorScheme: 'primary',
    },
    showLabel: false,
    selected: true,
  },
};

export const WithHandles: Story = {
  args: {
    data: {
      content: 'Node with handles',
      colorScheme: 'primary',
      handles: [
        { id: 'top-target', type: 'target', position: 'top' },
        { id: 'bottom-source', type: 'source', position: 'bottom' },
      ],
    },
    showLabel: false,
    selected: false,
  },
};

export const LabeledWithHandles: Story = {
  args: {
    data: {
      label: 'API Service',
      content: 'Handles requests from clients',
      colorScheme: 'secondary',
      handles: [
        { id: 'left-in', type: 'target', position: 'left' },
        { id: 'right-out', type: 'source', position: 'right' },
      ],
    },
    showLabel: true,
    selected: false,
  },
};

export const CustomSize: Story = {
  args: {
    data: {
      content: 'Custom sized node (250x120)',
      colorScheme: 'default',
      width: 250,
      height: 120,
    },
    showLabel: false,
    selected: false,
  },
};

export const MultilineContent: Story = {
  args: {
    data: {
      label: 'Details',
      content: 'Line 1\nLine 2\nLine 3',
      colorScheme: 'primary',
      width: 180,
      height: 100,
    },
    showLabel: true,
    selected: false,
  },
};
