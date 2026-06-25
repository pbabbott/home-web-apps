import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedProgressBar } from './SegmentedProgressBar';

const meta = {
  title: 'Components/SegmentedProgressBar',
  component: SegmentedProgressBar,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-64 p-4 bg-neutral-900 rounded-lg">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    totalSegments: { control: { type: 'number', min: 1, max: 20 } },
    currentIndex: { control: { type: 'number', min: 0 } },
    showLabel: { control: 'boolean' },
    labelText: { control: 'text' },
    showIndex: { control: 'boolean' },
  },
} satisfies Meta<typeof SegmentedProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IndexBeforeSegment: Story = {
  args: { totalSegments: 1, currentIndex: 0 },
};

export const IndexAtSegment: Story = {
  args: { totalSegments: 1, currentIndex: 1 },
};

export const IndexAfterSegment: Story = {
  args: { totalSegments: 1, currentIndex: 2 },
};

export const WithLabel: Story = {
  args: { totalSegments: 5, currentIndex: 3, showLabel: true },
};

export const WithIndex: Story = {
  args: { totalSegments: 5, currentIndex: 3, showIndex: true },
};

export const Default: Story = {
  args: {
    totalSegments: 5,
    currentIndex: 3,
    showLabel: true,
    labelText: 'Series Article',
    showIndex: true,
  },
};
