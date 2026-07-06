import type { Meta, StoryObj } from '@storybook/react-vite';
import { Scrollbar } from './Scrollbar';
import { Typography } from '../Typography/Typography';

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus magna. Cras in mi at felis aliquet congue. Ut a est eget ligula molestie gravida. Curabitur massa. Donec eleifend, libero at sagittis mollis, tellus est malesuada tellus, at luctus turpis elit sit amet quam. Vivamus pretium ornare est.';

const meta = {
  title: 'Components/Scrollbar',
  component: Scrollbar,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    height: { control: { type: 'number', min: 100, max: 600 } },
    width: { control: { type: 'number', min: 12, max: 40 } },
    tickCount: { control: { type: 'number', min: 2, max: 40 } },
    thumbPosition: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    thumbSize: { control: { type: 'range', min: 0.05, max: 1, step: 0.01 } },
    showDots: { control: 'boolean' },
  },
  args: {
    height: 320,
    tickCount: 20,
    thumbPosition: 0.15,
    thumbSize: 0.25,
  },
} satisfies Meta<typeof Scrollbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NearBottom: Story = {
  args: { thumbPosition: 0.75, thumbSize: 0.2 },
};

export const LargeThumb: Story = {
  args: { thumbPosition: 0.1, thumbSize: 0.6 },
};

export const SmallThumb: Story = {
  args: { thumbPosition: 0.4, thumbSize: 0.08 },
};

export const NoDots: Story = {
  args: { showDots: false },
};

export const WithContent: Story = {
  render: (args) => (
    <div className="flex flex-row gap-3 bg-neutral-900 p-6 rounded-lg w-96">
      <div className="flex-1 overflow-hidden" style={{ height: args.height }}>
        <Typography variant="body2" className="text-neutral-200">
          {LOREM.repeat(3)}
        </Typography>
      </div>
      <Scrollbar {...args} />
    </div>
  ),
};
