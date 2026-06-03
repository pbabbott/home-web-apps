import { useCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { within, userEvent } from 'storybook/test';
import {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  type Edge,
  type Node,
  type Connection,
} from '@xyflow/react';
import { DiagramViewer } from '../DiagramViewer/DiagramViewer';
import { DiagramEditor } from '../DiagramEditor/DiagramEditor';
import type { EditableEdgeColor } from './EdgeLabelContent';
import type { NodeColorScheme } from '../BaseNode/BaseNode';

function makeNodes(
  node1Color: NodeColorScheme = 'primary',
  node2Color: NodeColorScheme = 'secondary',
  node1Label = 'Node 1',
  node2Label = 'Node 2',
  node2X = 600,
): Node[] {
  return [
    {
      id: 'node-1',
      type: 'customDefault',
      position: { x: 100, y: 150 },
      data: {
        content: node1Label,
        colorScheme: node1Color,
        handles: [{ id: 'right-source', type: 'source', position: 'right' }],
      },
    },
    {
      id: 'node-2',
      type: 'customDefault',
      position: { x: node2X, y: 150 },
      data: {
        content: node2Label,
        colorScheme: node2Color,
        handles: [{ id: 'left-target', type: 'target', position: 'left' }],
      },
    },
  ];
}

function makeEdge(label: string, color: EditableEdgeColor): Edge {
  return {
    id: 'edge-1-2',
    source: 'node-1',
    target: 'node-2',
    sourceHandle: 'right-source',
    targetHandle: 'left-target',
    type: 'editable',
    data: { label, color },
  };
}

interface StoryProps {
  edgeLabel?: string;
  edgeColor?: EditableEdgeColor;
  node1Label?: string;
  node2Label?: string;
  node1Color?: NodeColorScheme;
  node2Color?: NodeColorScheme;
}

function StoryContainer({
  edgeLabel = '',
  edgeColor = 'primary',
  node1Label = 'Node 1',
  node2Label = 'Node 2',
  node1Color = 'primary',
  node2Color = 'secondary',
}: StoryProps) {
  return (
    <DiagramViewer
      height="400px"
      data={{
        nodes: makeNodes(node1Color, node2Color, node1Label, node2Label),
        edges: [makeEdge(edgeLabel, edgeColor)],
      }}
    />
  );
}

function EditableStoryContainer({
  edgeLabel = '',
  edgeColor = 'primary',
  node1Color = 'primary',
  node2Color = 'secondary',
}: StoryProps) {
  const [nodes, , onNodesChange] = useNodesState(
    makeNodes(node1Color, node2Color),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState([
    makeEdge(edgeLabel, edgeColor),
  ]);
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
        height="400px"
      />
    </ReactFlowProvider>
  );
}

const meta: Meta<typeof StoryContainer> = {
  title: 'Diagrams/EditableEdge',
  component: StoryContainer,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'diagram' },
    docs: {
      description: {
        component:
          'An editable edge component for React Flow diagrams. Supports click-to-edit labels on edges. Click on the edge label to edit it, press Cmd/Ctrl+Enter to save, or Escape to cancel. Requires @xyflow/react as a peer dependency.',
      },
    },
  },
  argTypes: {
    edgeLabel: { control: 'text', description: 'Label text for the edge' },
    edgeColor: {
      control: 'select',
      options: ['primary', 'secondary', 'default'],
      description: 'Color scheme for the edge label',
    },
    node1Label: { control: 'text', description: 'Label for the source node' },
    node2Label: { control: 'text', description: 'Label for the target node' },
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
    edgeColor: 'default',
    node1Color: 'primary',
    node2Color: 'secondary',
  },
};

// Matches what diagram-maker creates: no color set → resolveColor(undefined) → 'primary'
export const NewEdge: Story = {
  name: 'New Edge (Click to Add Label)',
  render: (args) => <EditableStoryContainer {...args} />,
  args: {
    edgeLabel: '',
    edgeColor: 'default',
    node1Color: 'primary',
    node2Color: 'secondary',
  },
};

export const NewEdgePrimaryColor: Story = {
  name: 'New Edge (Primary Color)',
  render: (args) => <EditableStoryContainer {...args} />,
  args: {
    edgeLabel: '',
    edgeColor: 'primary',
    node1Color: 'primary',
    node2Color: 'secondary',
  },
};

// Shows the textarea that appears after clicking "click to add label"
export const Editing: Story = {
  render: (args) => <EditableStoryContainer {...args} />,
  args: {
    edgeLabel: '',
    edgeColor: 'default',
    node1Color: 'primary',
    node2Color: 'secondary',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const placeholder = await canvas.findByText(
      'click to add label',
      {},
      { timeout: 5000 },
    );
    await userEvent.click(placeholder);
  },
};

export const DefaultColor: Story = {
  args: {
    edgeLabel: 'Default edge',
    edgeColor: 'default',
    node1Color: 'primary',
    node2Color: 'secondary',
  },
};

export const WithLabel: Story = {
  args: {
    edgeLabel: 'Connected',
    edgeColor: 'default',
    node1Color: 'primary',
    node2Color: 'secondary',
  },
};

export const LongLabel: Story = {
  args: {
    edgeLabel: 'This is a longer edge label',
    edgeColor: 'default',
    node1Label: 'Start',
    node2Label: 'End',
  },
};

export const MultiLineLabel: Story = {
  args: {
    edgeLabel: 'Line 1\nLine 2',
    edgeColor: 'primary',
    node1Color: 'primary',
    node2Color: 'secondary',
  },
};

export const PrimaryColor: Story = {
  args: {
    edgeLabel: 'Primary edge',
    edgeColor: 'primary',
    node1Color: 'primary',
    node2Color: 'primary',
  },
};

export const SecondaryColor: Story = {
  args: {
    edgeLabel: 'Secondary edge',
    edgeColor: 'secondary',
    node1Color: 'secondary',
    node2Color: 'secondary',
  },
};

export const MultipleEdges: Story = {
  render: () => {
    const nodes: Node[] = [
      {
        id: 'node-1',
        type: 'customDefault',
        position: { x: 100, y: 100 },
        data: {
          content: 'Node 1',
          colorScheme: 'primary',
          handles: [
            { id: 'right-source', type: 'source', position: 'right' },
            { id: 'bottom-source', type: 'source', position: 'bottom' },
          ],
        },
      },
      {
        id: 'node-2',
        type: 'customDefault',
        position: { x: 400, y: 100 },
        data: {
          content: 'Node 2',
          colorScheme: 'secondary',
          handles: [
            { id: 'left-target', type: 'target', position: 'left' },
            { id: 'bottom-source', type: 'source', position: 'bottom' },
          ],
        },
      },
      {
        id: 'node-3',
        type: 'customDefault',
        position: { x: 250, y: 300 },
        data: {
          content: 'Node 3',
          colorScheme: 'default',
          handles: [
            { id: 'top-target', type: 'target', position: 'top' },
            { id: 'left-target', type: 'target', position: 'left' },
          ],
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
        type: 'editable',
        data: { label: 'Horizontal', color: 'primary' },
      },
      {
        id: 'edge-1-3',
        source: 'node-1',
        target: 'node-3',
        sourceHandle: 'bottom-source',
        targetHandle: 'top-target',
        type: 'editable',
        data: { label: 'Vertical', color: 'secondary' },
      },
      {
        id: 'edge-2-3',
        source: 'node-2',
        target: 'node-3',
        sourceHandle: 'bottom-source',
        targetHandle: 'left-target',
        type: 'editable',
        data: { label: 'Diagonal', color: 'default' },
      },
    ];

    return <DiagramViewer height="500px" data={{ nodes, edges }} />;
  },
};
