import type { Meta, StoryObj } from '@storybook/react-vite';
import { DiagramViewer, type DiagramViewerProps } from './DiagramViewer';
import examplePostData from './blog-example-post.json';

const meta: Meta<typeof DiagramViewer> = {
  title: 'Diagrams/DiagramViewer',
  component: DiagramViewer,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'diagram' },
    docs: {
      description: {
        component:
          'Read-only React Flow diagram viewer. Supports labeled, customDefault, and text node types, plus default and editable edge types. Pan, zoom, and fullscreen built-in.',
      },
    },
  },
  argTypes: {
    animated: {
      control: 'boolean',
      description:
        'false suppresses the active-edge spark effect (e.g. reduced-motion mode)',
    },
  },
};

export default meta;

type Story = StoryObj<typeof DiagramViewer>;

export const Default: Story = {
  args: {
    data: examplePostData as DiagramViewerProps['data'],
    height: '500px',
  },
};

// First edge marked active so the two stories below can demonstrate the
// spark effect turning on/off with the `animated` prop.
const dataWithActiveEdge: DiagramViewerProps['data'] = {
  nodes: examplePostData.nodes as DiagramViewerProps['data']['nodes'],
  edges: (examplePostData.edges as DiagramViewerProps['data']['edges']).map(
    (edge, i) =>
      i === 0 ? { ...edge, data: { ...edge.data, active: true } } : edge,
  ),
};

export const AnimatedActiveEdge: Story = {
  name: 'Animated (active edge spark)',
  args: {
    data: dataWithActiveEdge,
    height: '500px',
    animated: true,
  },
};

export const StaticActiveEdge: Story = {
  name: 'animated=false (spark suppressed)',
  args: {
    data: dataWithActiveEdge,
    height: '500px',
    animated: false,
  },
};
