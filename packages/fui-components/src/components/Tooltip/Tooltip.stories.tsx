import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tooltip } from './Tooltip';

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
      description: 'Preferred side of the trigger',
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
      description: 'Alignment against the trigger',
    },
    delayDuration: {
      control: 'number',
      description: 'Milliseconds before opening on hover',
    },
    sideOffset: { control: 'number', description: 'Gap from the trigger' },
  },
  args: {
    content: 'Waiting for the agent to explore this directory.',
    defaultOpen: true,
    children: (
      <button type="button" className="border border-neutral-600 px-3 py-1">
        queued
      </button>
    ),
  },
  decorators: [
    (Story) => (
      <div className="flex h-[320px] w-[800px] items-center justify-center">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Top: Story = { args: { side: 'top' } };

export const Right: Story = { args: { side: 'right' } };

export const Bottom: Story = { args: { side: 'bottom' } };

export const Left: Story = { args: { side: 'left' } };

export const AlignStart: Story = {
  args: { side: 'bottom', align: 'start' },
};

export const LongContent: Story = {
  args: {
    content:
      'Not explored on purpose: excluded by a rule, covered by an approved inventory directory, or skipped by a human.',
  },
};
