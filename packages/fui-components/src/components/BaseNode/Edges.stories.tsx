import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ReactFlow,
  ReactFlowProvider,
  type NodeTypes,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { neutral } from '../../tokens/colors';
import { BaseNode, type BaseNodeData } from './BaseNode';

// Wrapper component for two connected nodes story
function TwoConnectedNodesWrapper() {
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

  const nodeTypes: NodeTypes = {
    baseNode: CustomNode,
  };

  const nodes = [
    {
      id: 'node-1',
      type: 'baseNode',
      position: { x: 100, y: 150 },
      data: {
        content: 'Node 1',
        colorScheme: 'primary',
        handles: [{ id: 'right-source', type: 'source', position: 'right' }],
      },
      selected: false,
    },
    {
      id: 'node-2',
      type: 'baseNode',
      position: { x: 400, y: 150 },
      data: {
        content: 'Node 2',
        colorScheme: 'secondary',
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
      type: 'default',
    },
  ];

  return (
    <div style={{ width: '100%', height: '400px', background: neutral[900] }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
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

const meta: Meta<typeof TwoConnectedNodesWrapper> = {
  title: 'Diagrams/Edges',
  component: TwoConnectedNodesWrapper,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Examples of BaseNode components connected with edges. Demonstrates handle connections between nodes.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof TwoConnectedNodesWrapper>;

export const TwoConnectedNodes: Story = {
  render: () => (
    <ReactFlowProvider>
      <TwoConnectedNodesWrapper />
    </ReactFlowProvider>
  ),
};
