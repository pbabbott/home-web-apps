import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusIndicator } from './StatusIndicator';

const meta = {
  title: 'Data Display/StatusIndicator',
  component: StatusIndicator,
  parameters: { layout: 'padded' },
  argTypes: {
    children: { control: 'text', description: 'The label (left)' },
    color: {
      control: 'select',
      options: ['success', 'error', 'warning', 'neutral', 'primary'],
      description: 'State color for the dot, status text and accent',
    },
    status: {
      control: 'text',
      description: 'Right-aligned status text; omit for the glowing dot',
    },
    pulse: { control: 'boolean', description: 'Pulse the dot' },
    component: {
      control: 'select',
      options: ['li', 'div'],
      description: 'Element to render as',
    },
  },
  args: { children: 'hogwarts.local' },
  decorators: [
    (Story) => (
      <ul className="w-96 list-none p-0">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof StatusIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ColorSuccess: Story = { args: { color: 'success' } };
export const ColorError: Story = { args: { color: 'error' } };
export const ColorWarning: Story = { args: { color: 'warning' } };
export const ColorNeutral: Story = { args: { color: 'neutral' } };
export const ColorPrimary: Story = { args: { color: 'primary' } };

export const StatusTextOk: Story = {
  args: { color: 'success', status: 'OK' },
};

export const StatusTextOffline: Story = {
  args: { color: 'error', status: 'Offline' },
};

export const NoPulse: Story = { args: { pulse: false } };

export const LongLabel: Story = {
  args: {
    children:
      'https://a-very-long-hostname.example.com/some/deeply/nested/health/check/endpoint',
    color: 'warning',
  },
};

export const AsDiv: Story = {
  args: { component: 'div', children: 'Rendered as a div' },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
};
