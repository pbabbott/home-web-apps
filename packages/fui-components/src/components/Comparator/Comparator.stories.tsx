import type { Meta, StoryObj } from '@storybook/react-vite';

import { Comparator } from './Comparator';

const meta = {
  title: 'Data Display/Comparator',
  component: Comparator,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    valueA: { control: 'text', description: 'Value in the left pill' },
    valueB: { control: 'text', description: 'Value in the right pill' },
    captionA: { control: 'text', description: 'Caption under the left pill' },
    captionB: { control: 'text', description: 'Caption under the right pill' },
    label: {
      control: 'text',
      description: 'Status text above the connector',
    },
    inSync: {
      control: 'boolean',
      description: 'Defaults to valueA === valueB; false breaks the connector',
    },
    active: {
      control: 'boolean',
      description: 'Animates sparks along the connector (only while in sync)',
    },
    color: {
      control: 'select',
      options: [undefined, 'primary', 'error'],
      description: 'Overrides the color derived from sync state',
    },
  },
  args: {
    valueA: '38907',
    valueB: '38907',
    captionA: 'Gluetun',
    captionB: 'qBittorrent',
    label: 'Synchronized',
  },
  decorators: [
    (Story) => (
      <div className="bg-neutral-800 p-10">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Comparator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Synchronized: Story = {};

export const OutOfSync: Story = {
  args: {
    valueB: '38911',
    label: 'Out-of-Sync',
  },
};

export const InSyncOverride: Story = {
  name: 'inSync Override',
  args: {
    valueB: '38911',
    inSync: true,
    label: 'Close enough',
  },
};

export const ColorOverride: Story = {
  name: 'Color Override',
  args: {
    color: 'error',
  },
};

export const NoLabelOrCaptions: Story = {
  args: {
    label: undefined,
    captionA: undefined,
    captionB: undefined,
  },
};

export const Active: Story = {
  args: {
    active: true,
  },
};

export const ActiveOutOfSync: Story = {
  args: {
    active: true,
    valueB: '38911',
    label: 'Out-of-Sync',
  },
};
