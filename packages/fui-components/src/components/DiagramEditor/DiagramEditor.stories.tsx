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
import { DiagramEditor } from './DiagramEditor';
import examplePostData from '../DiagramViewer/blog-example-post.json';

function DefaultStory() {
  const [nodes, , onNodesChange] = useNodesState<Node>(
    examplePostData.nodes as Node[],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    examplePostData.edges as Edge[],
  );
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
        height="500px"
      />
    </ReactFlowProvider>
  );
}

const meta: Meta = {
  title: 'Diagrams/DiagramEditor',
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'diagram' },
    docs: {
      description: {
        component:
          'Interactive React Flow diagram editor. Nodes are draggable and selectable. Edges support click-to-edit labels. Requires ReactFlowProvider and controlled nodes/edges from the caller.',
      },
    },
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => <DefaultStory />,
};
