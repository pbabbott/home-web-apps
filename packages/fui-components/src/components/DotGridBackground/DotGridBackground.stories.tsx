import type { Meta, StoryObj } from '@storybook/react-vite';
import { DotGridBackground } from './DotGridBackground';

const meta = {
  title: 'Components/DotGridBackground',
  component: DotGridBackground,
  args: {
    color: 'default',
  },
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
} satisfies Meta<typeof DotGridBackground>;

export default meta;
type Story = StoryObj<typeof meta>;
const width = 480;
const height = 280;

export const Default: Story = {
  render: (args) => (
    <div style={{ position: 'relative', width, height }}>
      <DotGridBackground {...args} />
    </div>
  ),
};

export const Active: Story = {
  render: (args) => (
    <div style={{ position: 'relative', width, height }}>
      <DotGridBackground {...args} active />
    </div>
  ),
};
export const Primary: Story = {
  render: (args) => (
    <div style={{ position: 'relative', width, height }}>
      <DotGridBackground {...args} color="primary" />
    </div>
  ),
};
export const PrimaryActive: Story = {
  render: (args) => (
    <div style={{ position: 'relative', width, height }}>
      <DotGridBackground {...args} color="primary" active />
    </div>
  ),
};
