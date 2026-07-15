import type { Meta, StoryObj } from '@storybook/react-vite';

import { AIContent } from './AIContent';

const meta = {
  title: 'Components/AIContent',
  component: AIContent,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    highlighted: {
      control: 'boolean',
      description: 'Whether this block is flagged as AI-generated',
    },
    animated: {
      control: 'boolean',
      description: 'Pulsing glow vs a static highlight',
    },
  },
  args: {
    highlighted: true,
    animated: true,
    children: 'This paragraph was written by an AI - not a human.',
  },
  decorators: [
    (Story) => (
      <div className="w-96 bg-neutral-800 p-6 text-neutral-50">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AIContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unhighlighted: Story = {
  args: {
    highlighted: false,
  },
};

export const HighlightedAnimated: Story = {
  args: {
    highlighted: true,
    animated: true,
  },
};

export const HighlightedStatic: Story = {
  args: {
    highlighted: true,
    animated: false,
  },
};
