import type { Meta, StoryObj } from '@storybook/react-vite';
import { DiagramViewer } from '../DiagramViewer/DiagramViewer';

interface StoryProps {
  label: string;
  content: string;
}

function StoryContainer({ label, content }: StoryProps) {
  return (
    <DiagramViewer
      height="300px"
      data={{
        nodes: [
          {
            id: 'node-1',
            type: 'labeled',
            position: { x: 100, y: 100 },
            data: { label, content },
          },
        ],
        edges: [],
      }}
    />
  );
}

const meta: Meta<typeof StoryContainer> = {
  title: 'Diagrams/LabeledNode',
  component: StoryContainer,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'diagram' },
    docs: {
      description: {
        component:
          'A box node for React Flow diagrams with a label badge rendered above the top-left corner. Use DefaultNode when no label is needed.',
      },
    },
  },
  argTypes: {
    label: { control: 'text', description: 'Label badge text above the node' },
    content: { control: 'text', description: 'Text content inside the node' },
  },
};

export default meta;

type Story = StoryObj<typeof StoryContainer>;

export const Default: Story = {
  args: {
    label: 'My Label',
    content: 'Labeled Node',
  },
};

// Shows the label textarea, as seen after double-clicking the label badge
export const Editing: Story = {
  render: () => (
    <DiagramViewer
      height="300px"
      data={{
        nodes: [
          {
            id: 'node-1',
            type: 'labeled',
            position: { x: 100, y: 100 },
            data: {
              label: 'Editing label',
              content: 'Labeled Node',
              startInLabelEdit: true,
            },
          },
        ],
        edges: [],
      }}
    />
  ),
};
