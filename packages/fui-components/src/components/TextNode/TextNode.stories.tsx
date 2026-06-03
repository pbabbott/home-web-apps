import type { Meta, StoryObj } from '@storybook/react-vite';
import { DiagramViewer } from '../DiagramViewer/DiagramViewer';
import type { NodeColorScheme } from '../BaseNode/BaseNode';
import type { IconRenderer } from '../../types/icons';

const placeholderIcon: IconRenderer = ({ size }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="2" y="2" width="20" height="20" rx="3" fill="#3b82f6" />
    <rect x="7" y="7" width="4" height="4" fill="white" opacity="0.9" />
    <rect x="13" y="7" width="4" height="4" fill="white" opacity="0.9" />
    <rect x="7" y="13" width="4" height="4" fill="white" opacity="0.9" />
    <rect x="13" y="13" width="4" height="4" fill="white" opacity="0.9" />
  </svg>
);

interface StoryProps {
  content: string;
  colorScheme: NodeColorScheme;
  selected: boolean;
}

function StoryContainer({ content, colorScheme, selected }: StoryProps) {
  return (
    <DiagramViewer
      height="300px"
      data={{
        nodes: [
          {
            id: 'node-1',
            type: 'text',
            position: { x: 150, y: 120 },
            data: { content, colorScheme },
            selected,
          },
        ],
        edges: [],
      }}
    />
  );
}

const meta: Meta<typeof StoryContainer> = {
  title: 'Diagrams/TextNode',
  component: StoryContainer,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'diagram' },
    docs: {
      description: {
        component:
          'A borderless text node for React Flow diagrams. No box or handles — use for labels, annotations, or free-floating text. Double-click to edit (unless readonly).',
      },
    },
  },
  argTypes: {
    content: { control: 'text', description: 'Text content of the node' },
    colorScheme: {
      control: 'select',
      options: [
        'default',
        'dark',
        'white',
        'primary',
        'secondary',
        'success',
        'error',
        'warning',
        'accent-purple',
        'accent-falcon',
      ],
      description: 'Text color scheme',
    },
    selected: {
      control: 'boolean',
      description: 'Whether the node is selected (shows outline)',
    },
  },
};

export default meta;

type Story = StoryObj<typeof StoryContainer>;

export const Default: Story = {
  args: {
    content: 'Text Node',
    colorScheme: 'default',
    selected: false,
  },
};

export const Primary: Story = {
  args: {
    content: 'Primary text',
    colorScheme: 'primary',
    selected: false,
  },
};

export const Secondary: Story = {
  args: {
    content: 'Secondary text',
    colorScheme: 'secondary',
    selected: false,
  },
};

export const Dark: Story = {
  args: {
    content: 'Dark text',
    colorScheme: 'dark',
    selected: false,
  },
};

export const White: Story = {
  args: {
    content: 'White text',
    colorScheme: 'white',
    selected: false,
  },
};

export const Selected: Story = {
  args: {
    content: 'Selected node',
    colorScheme: 'default',
    selected: true,
  },
};

export const Multiline: Story = {
  args: {
    content: 'Line 1\nLine 2\nLine 3',
    colorScheme: 'primary',
    selected: false,
  },
};

export const Readonly: Story = {
  render: () => (
    <DiagramViewer
      height="300px"
      data={{
        nodes: [
          {
            id: 'node-1',
            type: 'text',
            position: { x: 150, y: 120 },
            data: {
              content: 'Readonly text',
              colorScheme: 'default',
              readonly: true,
            },
          },
        ],
        edges: [],
      }}
    />
  ),
};

export const WithIcon: Story = {
  render: () => (
    <DiagramViewer
      height="300px"
      renderIcon={placeholderIcon}
      data={{
        nodes: [
          {
            id: 'node-1',
            type: 'text',
            position: { x: 150, y: 120 },
            data: {
              content: 'Text with icon',
              colorScheme: 'default',
              iconId: 'placeholder',
            },
          },
        ],
        edges: [],
      }}
    />
  ),
};
