import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { TransparentPanel } from './TransparentPanel';
import { type ReactNode } from 'react';

const meta = {
  title: 'Components/TransparentPanel',
  component: TransparentPanel,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    color: {
      control: 'select',
      options: [
        'default',
        'dark',
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
} satisfies Meta<typeof TransparentPanel>;

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
    <TransparentPanel {...args}>
      <PanelContent>Transparent Panel</PanelContent>
    </TransparentPanel>
  ),
};

export const Dark: Story = {
  args: {
    color: 'dark',
  },
  render: (args) => (
    <TransparentPanel {...args}>
      <PanelContent>Dark Transparent Panel</PanelContent>
    </TransparentPanel>
  ),
};

export const White: Story = {
  args: {
    color: 'white',
  },
  render: (args) => (
    <TransparentPanel {...args}>
      <PanelContent>White Transparent Panel</PanelContent>
    </TransparentPanel>
  ),
};

export const Primary: Story = {
  args: {
    color: 'primary',
  },
  render: (args) => (
    <TransparentPanel {...args}>
      <PanelContent>Primary Transparent Panel</PanelContent>
    </TransparentPanel>
  ),
};

export const Secondary: Story = {
  args: {
    color: 'secondary',
  },
  render: (args) => (
    <TransparentPanel {...args}>
      <PanelContent>Secondary Transparent Panel</PanelContent>
    </TransparentPanel>
  ),
};

export const Success: Story = {
  args: {
    color: 'success',
  },
  render: (args) => (
    <TransparentPanel {...args}>
      <PanelContent>Success Transparent Panel</PanelContent>
    </TransparentPanel>
  ),
};

export const Error: Story = {
  args: {
    color: 'error',
  },
  render: (args) => (
    <TransparentPanel {...args}>
      <PanelContent>Error Transparent Panel</PanelContent>
    </TransparentPanel>
  ),
};

export const Warning: Story = {
  args: {
    color: 'warning',
  },
  render: (args) => (
    <TransparentPanel {...args}>
      <PanelContent>Warning Transparent Panel</PanelContent>
    </TransparentPanel>
  ),
};

export const AccentPurple: Story = {
  args: {
    color: 'accent-purple',
  },
  render: (args) => (
    <TransparentPanel {...args}>
      <PanelContent>Accent Purple Transparent Panel</PanelContent>
    </TransparentPanel>
  ),
};

export const AccentFalcon: Story = {
  args: {
    color: 'accent-falcon',
  },
  render: (args) => (
    <TransparentPanel {...args}>
      <PanelContent>Accent Falcon Transparent Panel</PanelContent>
    </TransparentPanel>
  ),
};
