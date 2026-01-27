import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ReactFlow,
  ReactFlowProvider,
  type NodeTypes,
  type EdgeTypes,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { neutral } from '../../tokens/colors';
import { BaseNode, type BaseNodeData } from '../BaseNode/BaseNode';
import { EditableEdge } from './EditableEdge';

// Wrapper component that renders EditableEdge between two nodes
function EditableEdgeStoryWrapper(props: {
  edgeLabel?: string;
  node1Label?: string;
  node2Label?: string;
  node1Color?: 'primary' | 'secondary' | 'default';
  node2Color?: 'primary' | 'secondary' | 'default';
}) {
  const {
    edgeLabel,
    node1Label = 'Node 1',
    node2Label = 'Node 2',
    node1Color = 'primary',
    node2Color = 'secondary',
  } = props;

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
      showLabel={false}
    />
  );

  // Create a custom edge component that passes through to EditableEdge
  const CustomEdge = (edgeProps: Parameters<typeof EditableEdge>[0]) => (
    <EditableEdge {...edgeProps} />
  );

  const nodeTypes: NodeTypes = {
    baseNode: CustomNode,
  };

  const edgeTypes: EdgeTypes = {
    editable: CustomEdge,
  };

  const nodes = [
    {
      id: 'node-1',
      type: 'baseNode',
      position: { x: 100, y: 150 },
      data: {
        content: node1Label,
        colorScheme: node1Color,
        handles: [{ id: 'right-source', type: 'source', position: 'right' }],
      },
      selected: false,
    },
    {
      id: 'node-2',
      type: 'baseNode',
      position: { x: 400, y: 150 },
      data: {
        content: node2Label,
        colorScheme: node2Color,
        handles: [{ id: 'left-target', type: 'target', position: 'left' }],
      },
      selected: false,
    },
  ];

  const edges: Edge[] = [
    {
      id: 'edge-1-2',
      source: 'node-1',
      target: 'node-2',
      sourceHandle: 'right-source',
      targetHandle: 'left-target',
      type: 'editable',
      data: {
        label: edgeLabel,
      },
    },
  ];

  return (
    <div style={{ width: '100%', height: '400px', background: neutral[900] }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
function StoryContainer(props: {
  edgeLabel?: string;
  node1Label?: string;
  node2Label?: string;
  node1Color?: 'primary' | 'secondary' | 'default';
  node2Color?: 'primary' | 'secondary' | 'default';
}) {
  return (
    <ReactFlowProvider>
      <EditableEdgeStoryWrapper {...props} />
    </ReactFlowProvider>
  );
}

const meta: Meta<typeof StoryContainer> = {
  title: 'Diagrams/EditableEdge',
  component: StoryContainer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'An editable edge component for React Flow diagrams. Supports click-to-edit labels on edges. Click on the edge label to edit it, press Enter to save, or Escape to cancel. Requires @xyflow/react as a peer dependency.',
      },
    },
  },
  argTypes: {
    edgeLabel: {
      control: 'text',
      description: 'Initial label text for the edge',
    },
    node1Label: {
      control: 'text',
      description: 'Label for the source node',
    },
    node2Label: {
      control: 'text',
      description: 'Label for the target node',
    },
    node1Color: {
      control: 'select',
      options: ['primary', 'secondary', 'default'],
      description: 'Color scheme for the source node',
    },
    node2Color: {
      control: 'select',
      options: ['primary', 'secondary', 'default'],
      description: 'Color scheme for the target node',
    },
  },
};

export default meta;

type Story = StoryObj<typeof StoryContainer>;

export const Default: Story = {
  args: {
    edgeLabel: '',
    node1Label: 'Node 1',
    node2Label: 'Node 2',
    node1Color: 'primary',
    node2Color: 'secondary',
  },
};

export const WithLabel: Story = {
  args: {
    edgeLabel: 'Connected',
    node1Label: 'Source',
    node2Label: 'Target',
    node1Color: 'primary',
    node2Color: 'secondary',
  },
};

export const LongLabel: Story = {
  args: {
    edgeLabel: 'This is a longer edge label',
    node1Label: 'Start',
    node2Label: 'End',
    node1Color: 'primary',
    node2Color: 'secondary',
  },
};

export const MultiLineLabel: Story = {
  args: {
    edgeLabel: 'Line 1\nLine 2\nLine 3',
    node1Label: 'Source',
    node2Label: 'Target',
    node1Color: 'primary',
    node2Color: 'secondary',
  },
};

export const MultipleEdges: Story = {
  render: () => {
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
        showLabel={false}
      />
    );

    const CustomEdge = (edgeProps: Parameters<typeof EditableEdge>[0]) => (
      <EditableEdge {...edgeProps} />
    );

    const nodeTypes: NodeTypes = {
      baseNode: CustomNode,
    };

    const edgeTypes: EdgeTypes = {
      editable: CustomEdge,
    };

    const nodes = [
      {
        id: 'node-1',
        type: 'baseNode',
        position: { x: 100, y: 100 },
        data: {
          content: 'Node 1',
          colorScheme: 'primary',
          handles: [
            { id: 'right-source', type: 'source', position: 'right' },
            { id: 'bottom-source', type: 'source', position: 'bottom' },
          ],
        },
        selected: false,
      },
      {
        id: 'node-2',
        type: 'baseNode',
        position: { x: 400, y: 100 },
        data: {
          content: 'Node 2',
          colorScheme: 'secondary',
          handles: [
            { id: 'left-target', type: 'target', position: 'left' },
            { id: 'bottom-source', type: 'source', position: 'bottom' },
          ],
        },
        selected: false,
      },
      {
        id: 'node-3',
        type: 'baseNode',
        position: { x: 250, y: 300 },
        data: {
          content: 'Node 3',
          colorScheme: 'default',
          handles: [
            { id: 'top-target', type: 'target', position: 'top' },
            { id: 'left-target', type: 'target', position: 'left' },
          ],
        },
        selected: false,
      },
    ];

    const edges: Edge[] = [
      {
        id: 'edge-1-2',
        source: 'node-1',
        target: 'node-2',
        sourceHandle: 'right-source',
        targetHandle: 'left-target',
        type: 'editable',
        data: {
          label: 'Horizontal',
        },
      },
      {
        id: 'edge-1-3',
        source: 'node-1',
        target: 'node-3',
        sourceHandle: 'bottom-source',
        targetHandle: 'top-target',
        type: 'editable',
        data: {
          label: 'Vertical',
        },
      },
      {
        id: 'edge-2-3',
        source: 'node-2',
        target: 'node-3',
        sourceHandle: 'bottom-source',
        targetHandle: 'left-target',
        type: 'editable',
        data: {
          label: 'Diagonal',
        },
      },
    ];

    return (
      <ReactFlowProvider>
        <div
          style={{ width: '100%', height: '500px', background: neutral[900] }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.5 }}
            nodesDraggable={true}
            nodesConnectable={true}
            elementsSelectable={true}
            proOptions={{ hideAttribution: true }}
          />
        </div>
      </ReactFlowProvider>
    );
  },
};
