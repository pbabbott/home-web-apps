import type { Meta, StoryObj } from '@storybook/react-vite';

import { ListItem } from './ListItem';

const meta = {
  title: 'Data Display/ListItem',
  component: ListItem,
  parameters: { layout: 'padded' },
  argTypes: {
    children: { control: 'text', description: 'The row text' },
    color: {
      control: 'select',
      options: [
        undefined,
        'neutral',
        'primary',
        'secondary',
        'success',
        'error',
        'warning',
        'accent-purple',
        'accent-falcon',
        'dark',
      ],
      description: 'Translucent fill color; omit for a transparent row',
    },
    startAdornment: { control: false, description: 'Shown before the text' },
    endAdornment: { control: false, description: 'Shown after the text' },
    component: {
      control: 'select',
      options: ['li', 'div'],
      description: 'Element to render as',
    },
  },
  args: { children: 'List item' },
  decorators: [
    (Story) => (
      <ul className="w-96 list-none">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof ListItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Adornments: Story = {
  args: {
    children: '/Volumes/Photos/2019',
    startAdornment: <div className="size-3 bg-primary-400" />,
    endAdornment: <div className="h-2 w-8 bg-neutral-400" />,
  },
};

export const LongText: Story = {
  args: {
    children:
      '/Volumes/Photos/2019/Summer/A/very/deeply/nested/path/with/a/rather/long/file-name-that-must-wrap.jpg',
    startAdornment: <div className="size-3 bg-neutral-400" />,
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

export const ColorPrimary: Story = {
  args: { color: 'primary', children: 'primary' },
};
