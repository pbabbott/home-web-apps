import type { Meta, StoryObj } from '@storybook/react-vite';
import { DiagramViewer } from './DiagramViewer';
import examplePostData from '../../../../../apps/diagram-maker/src/diagrams/blog-example-post.json';

const meta: Meta<typeof DiagramViewer> = {
  title: 'Diagrams/DiagramViewer',
  component: DiagramViewer,
  parameters: {
    layout: 'padded',
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
    data: examplePostData,
    height: '500px',
  },
};
