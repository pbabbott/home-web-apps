import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { Panel } from './Panel';
import { type ReactNode } from 'react';

const meta = {
  title: 'Components/Panel',
  component: Panel,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['transparent', 'outlined', 'dots'],
      description: 'The variant of the panel',
    },
    color: {
      control: 'select',
      options: [
        'default',
        'white',
        'primary',
        'secondary',
        'success',
        'error',
        'warning',
        'accent-purple',
        'accent-falcon',
      ],
      description: 'The color scheme of the panel',
    },
    children: {
      control: 'text',
      description: 'The content of the panel',
    },
    onClick: { action: 'clicked' },
  },
  args: {
    onClick: fn(),
    children: 'Panel content', // Default text for all stories
  },
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

const PanelContent = ({ children }: { children: ReactNode }) => {
  return <div className="m-20 text-body2">{children}</div>;
};

export const Default: Story = {
  args: {
    color: 'primary',
    variant: 'dots',
    children: <PanelContent>Accent Falcon</PanelContent>,
  },
};

// Example showing all variants for a single color
export const VariantShowcase: Story = {
  render: (args) => (
    <div className="flex gap-4">
      <Panel {...args} variant="transparent">
        <PanelContent>Transparent</PanelContent>
      </Panel>
      <Panel {...args} variant="outlined">
        <PanelContent>Outlined</PanelContent>
      </Panel>
      <Panel {...args} variant="dots">
        <PanelContent>Dots</PanelContent>
      </Panel>
    </div>
  ),
};
