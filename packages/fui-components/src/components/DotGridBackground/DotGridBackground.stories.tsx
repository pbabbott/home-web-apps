import type { Meta, StoryObj } from '@storybook/react-vite';
import { DotGridBackground } from './DotGridBackground';

const meta = {
  title: 'Components/DotGridBackground',
  component: DotGridBackground,
  args: {
    color: 'default',
  },
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
} satisfies Meta<typeof DotGridBackground>;

export default meta;
type Story = StoryObj<typeof meta>;

const fullscreenWrapperStyle: React.CSSProperties = {
  position: 'relative',
  width: '100vw',
  height: '100vh',
};

export const Default: Story = {
  render: (args) => (
    <div style={fullscreenWrapperStyle}>
      <DotGridBackground {...args} />
    </div>
  ),
};

export const Active: Story = {
  render: (args) => (
    <div style={fullscreenWrapperStyle}>
      <DotGridBackground {...args} active />
    </div>
  ),
};
export const Primary: Story = {
  render: (args) => (
    <div style={fullscreenWrapperStyle}>
      <DotGridBackground {...args} color="primary" />
    </div>
  ),
};
export const PrimaryActive: Story = {
  render: (args) => (
    <div style={fullscreenWrapperStyle}>
      <DotGridBackground {...args} color="primary" active />
    </div>
  ),
};
