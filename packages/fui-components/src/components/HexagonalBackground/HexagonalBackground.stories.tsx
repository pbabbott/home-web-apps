import type { Meta, StoryObj } from '@storybook/react-vite';
import { HexagonalBackground } from './HexagonalBackground';

const meta = {
  title: 'Components/HexagonalBackground',
  component: HexagonalBackground,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
} satisfies Meta<typeof HexagonalBackground>;

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
      <HexagonalBackground {...args} />
    </div>
  ),
};
