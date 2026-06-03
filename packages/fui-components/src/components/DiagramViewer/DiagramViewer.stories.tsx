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
};

export default meta;

type Story = StoryObj<typeof DiagramViewer>;

export const Default: Story = {
  args: {
    data: examplePostData as DiagramViewerProps['data'],
    height: '500px',
  },
};
