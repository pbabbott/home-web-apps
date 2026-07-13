import { useEffect, useState } from 'react';
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

export const SparksDisabled: Story = {
  args: {
    sparksEnabled: false,
  },
  render: (args) => (
    <div style={fullscreenWrapperStyle}>
      <HexagonalBackground {...args} />
    </div>
  ),
};

// Demonstrates sparksFrozen: sparks run normally, then freeze in place after a
// delay — distinct from sparksEnabled={false}, which hides them entirely.
function FreezeAfterDelayDemo() {
  const [frozen, setFrozen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFrozen(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={fullscreenWrapperStyle}>
      <HexagonalBackground sparksFrozen={frozen} />
    </div>
  );
}

export const SparksFrozen: Story = {
  render: () => <FreezeAfterDelayDemo />,
};

export const IceTheme: Story = {
  args: {
    theme: 'ice',
  },
  render: (args) => (
    <div style={fullscreenWrapperStyle}>
      <HexagonalBackground {...args} />
    </div>
  ),
};

export const ErrorTheme: Story = {
  args: {
    theme: 'error',
  },
  render: (args) => (
    <div style={fullscreenWrapperStyle}>
      <HexagonalBackground {...args} />
    </div>
  ),
};
