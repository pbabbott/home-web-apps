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
    color: 'default',
  },
  render: (args) => (
    <Panel {...args}>
      <PanelContent>Default</PanelContent>
    </Panel>
  ),
};

export const Primary: Story = {
  args: {
    color: 'primary',
  },
  render: (args) => (
    <Panel {...args}>
      <PanelContent>Primary</PanelContent>
    </Panel>
  ),
};
