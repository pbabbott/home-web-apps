import type { Meta, StoryObj } from '@storybook/react-vite';
import { DiagramViewer } from '../DiagramViewer/DiagramViewer';

interface StoryProps {
  content: string;
}

function StoryContainer({ content }: StoryProps) {
  return (
    <DiagramViewer
      height="300px"
      data={{
        nodes: [
          {
            id: 'node-1',
            type: 'customDefault',
            position: { x: 100, y: 100 },
            data: { content },
          },
        ],
        edges: [],
      }}
    />
  );
}

const meta: Meta<typeof StoryContainer> = {
  title: 'Diagrams/DefaultNode',
  component: StoryContainer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A box node for React Flow diagrams. Renders content without a label header. Use LabeledNode when a label badge is needed.',
      },
    },
  },
  argTypes: {
    content: { control: 'text', description: 'Text content inside the node' },
  },
};

export default meta;

type Story = StoryObj<typeof StoryContainer>;

export const Default: Story = {
  args: {
    content: 'Default Node',
  },
};
